/**
 * Follow Service
 * Business logic for user follow/unfollow operations
 */

import mongoose from "mongoose";
import User from "../models/users/User.js";
import UserFollower from "../models/users/UserFollower.js";
import { createNotification } from "./notification.service.js";
import { NotificationType } from "../models/enums.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";

/**
 * Follow a user
 * @param {string} followerId - ID of user who wants to follow
 * @param {string} targetUserId - ID of user to be followed
 * @returns {Promise<Object>} Follow relationship and updated counts
 */
export const followUser = async (followerId, targetUserId) => {
  try {
    // Prevent self-follow
    if (followerId === targetUserId) {
      throw new Error("You cannot follow yourself");
    }

    // Validate target user exists and is not deleted
    const targetUser = await User.findOne({
      _id: targetUserId,
      isDeleted: false,
    });

    if (!targetUser) {
      throw new Error("User not found");
    }

    // Validate follower exists and is not deleted
    const follower = await User.findOne({
      _id: followerId,
      isDeleted: false,
    });

    if (!follower) {
      throw new Error("Follower not found");
    }

    // Check if already following
    const existingFollow = await UserFollower.findOne({
      userId: targetUserId,
      followerId: followerId,
    });

    if (existingFollow) {
      throw new Error("You are already following this user");
    }

    // Create follow relationship
    const followRelation = await UserFollower.create({
      userId: targetUserId,
      followerId: followerId,
    });

    // Update follower count for target user
    await User.findByIdAndUpdate(targetUserId, {
      $inc: { followerCount: 1 },
    });

    // Update following count for follower
    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: 1 },
    });

    // Create notification for target user
    try {
      await createNotification({
        receiverId: targetUserId,
        senderId: followerId,
        type: NotificationType.NEW_FOLLOWER,
      });
    } catch (notificationError) {
      // Log error but don't fail the follow operation
      logger.error("Error creating follow notification:", notificationError);
    }

    logger.info(
      `User ${followerId} followed user ${targetUserId}`
    );

    // Get updated counts
    const updatedTargetUser = await User.findById(targetUserId).select(
      "followerCount followingCount"
    );
    const updatedFollower = await User.findById(followerId).select(
      "followerCount followingCount"
    );

    return {
      followRelation: {
        id: followRelation._id.toString(),
        userId: targetUserId,
        followerId: followerId,
        createdAt: followRelation.createdAt,
      },
      targetUser: {
        id: targetUser._id.toString(),
        username: targetUser.username,
        name: targetUser.name,
        followerCount: updatedTargetUser.followerCount,
        followingCount: updatedTargetUser.followingCount,
      },
      follower: {
        id: follower._id.toString(),
        username: follower.username,
        name: follower.name,
        followerCount: updatedFollower.followerCount,
        followingCount: updatedFollower.followingCount,
      },
    };
  } catch (error) {
    logger.error("Error in followUser:", error);
    throw error;
  }
};

/**
 * Unfollow a user
 * @param {string} followerId - ID of user who wants to unfollow
 * @param {string} targetUserId - ID of user to be unfollowed
 * @returns {Promise<Object>} Updated counts
 */
export const unfollowUser = async (followerId, targetUserId) => {
  try {
    // Prevent self-unfollow (though this shouldn't happen)
    if (followerId === targetUserId) {
      throw new Error("You cannot unfollow yourself");
    }

    // Validate target user exists
    const targetUser = await User.findOne({
      _id: targetUserId,
      isDeleted: false,
    });

    if (!targetUser) {
      throw new Error("User not found");
    }

    // Validate follower exists
    const follower = await User.findOne({
      _id: followerId,
      isDeleted: false,
    });

    if (!follower) {
      throw new Error("Follower not found");
    }

    // Check if following relationship exists
    const followRelation = await UserFollower.findOne({
      userId: targetUserId,
      followerId: followerId,
    });

    if (!followRelation) {
      throw new Error("You are not following this user");
    }

    // Delete follow relationship
    await UserFollower.findByIdAndDelete(followRelation._id);

    // Update follower count for target user (decrement)
    await User.findByIdAndUpdate(targetUserId, {
      $inc: { followerCount: -1 },
    });

    // Update following count for follower (decrement)
    await User.findByIdAndUpdate(followerId, {
      $inc: { followingCount: -1 },
    });

    // Delete follow notification if exists (optional cleanup)
    // Note: We don't delete notifications on unfollow as per common UX patterns

    logger.info(
      `User ${followerId} unfollowed user ${targetUserId}`
    );

    // Get updated counts
    const updatedTargetUser = await User.findById(targetUserId).select(
      "followerCount followingCount"
    );
    const updatedFollower = await User.findById(followerId).select(
      "followerCount followingCount"
    );

    return {
      targetUser: {
        id: targetUser._id.toString(),
        username: targetUser.username,
        name: targetUser.name,
        followerCount: updatedTargetUser.followerCount,
        followingCount: updatedTargetUser.followingCount,
      },
      follower: {
        id: follower._id.toString(),
        username: follower.username,
        name: follower.name,
        followerCount: updatedFollower.followerCount,
        followingCount: updatedFollower.followingCount,
      },
    };
  } catch (error) {
    logger.error("Error in unfollowUser:", error);
    throw error;
  }
};

/**
 * Check if user is following another user
 * @param {string} followerId - ID of potential follower
 * @param {string} targetUserId - ID of target user
 * @returns {Promise<boolean>} True if following
 */
export const isFollowing = async (followerId, targetUserId) => {
  try {
    const followRelation = await UserFollower.findOne({
      userId: targetUserId,
      followerId: followerId,
    });

    return !!followRelation;
  } catch (error) {
    logger.error("Error in isFollowing:", error);
    throw error;
  }
};

/**
 * Get followers list
 * @param {string} userId - User ID whose followers to get
 * @param {string} currentUserId - Current authenticated user ID (to check follow status)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @param {string} search - Search term for username (optional)
 * @returns {Promise<Object>} Followers list with pagination
 */
export const getFollowers = async (userId, currentUserId, page = 1, limit = 20, search = null) => {
  try {
    const skip = (page - 1) * limit;

    // Build query for followers
    let followersQuery = UserFollower.find({ userId });

    // If search term provided, filter by username
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i"); // Case-insensitive search
      followersQuery = followersQuery.populate({
        path: "followerId",
        select: "username name profileImage bio isVerifiedBadge",
        match: { username: searchRegex, isDeleted: false },
      });
    } else {
      followersQuery = followersQuery.populate("followerId", "username name profileImage bio isVerifiedBadge");
    }

    const followers = await followersQuery
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter out null results (from populate match)
    const filteredFollowers = followers.filter((f) => f.followerId !== null);

    // Normalize ID for consistent map keys (ObjectId or string)
    const toIdStr = (id) => (id && typeof id === "object" && id.toString ? id.toString() : String(id));

    // Get follower IDs to check follow status (people in the list)
    const followerIds = filteredFollowers.map((f) => toIdStr(f.followerId._id));

    // Check which of these users the current user is following (status = "following")
    const followingMap = new Map();
    if (currentUserId && followerIds.length > 0) {
      let objectIds;
      try {
        objectIds = followerIds.map((id) => new mongoose.Types.ObjectId(id));
      } catch (_) {
        objectIds = followerIds;
      }
      const followingRelations = await UserFollower.find({
        userId: { $in: objectIds },
        followerId: currentUserId,
      })
        .select("userId")
        .lean();

      followingRelations.forEach((rel) => {
        const id = rel.userId ? toIdStr(rel.userId) : null;
        if (id) followingMap.set(id, true);
      });
    }

    // Get total count (with search filter if provided)
    let total;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const allFollowers = await UserFollower.find({ userId }).populate({
        path: "followerId",
        select: "username",
        match: { username: searchRegex, isDeleted: false },
      });
      total = allFollowers.filter((f) => f.followerId !== null).length;
    } else {
      total = await UserFollower.countDocuments({ userId });
    }

    const currentUserIdStr = currentUserId ? toIdStr(currentUserId) : null;

    return {
      followers: filteredFollowers.map((f) => {
        const fid = toIdStr(f.followerId._id);
        let status = "not_following";
        if (currentUserIdStr && fid === currentUserIdStr) {
          status = "self";
        } else if (currentUserIdStr && followingMap.has(fid)) {
          status = "following";
        }

        return {
          id: fid,
          username: f.followerId.username,
          name: f.followerId.name,
          profileImage: f.followerId.profileImage,
          bio: f.followerId.bio,
          isVerifiedBadge: f.followerId.isVerifiedBadge,
          followedAt: f.createdAt,
          status,
        };
      }),
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getFollowers:", error);
    throw error;
  }
};

/**
 * Get following list
 * @param {string} userId - User ID whose following list to get
 * @param {string} currentUserId - Current authenticated user ID (to check follow status)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @param {string} search - Search term for username (optional)
 * @returns {Promise<Object>} Following list with pagination
 */
export const getFollowing = async (userId, currentUserId, page = 1, limit = 20, search = null) => {
  try {
    const skip = (page - 1) * limit;

    // Build query for following
    let followingQuery = UserFollower.find({ followerId: userId });

    // If search term provided, filter by username
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i"); // Case-insensitive search
      followingQuery = followingQuery.populate({
        path: "userId",
        select: "username name profileImage bio isVerifiedBadge",
        match: { username: searchRegex, isDeleted: false },
      });
    } else {
      followingQuery = followingQuery.populate("userId", "username name profileImage bio isVerifiedBadge");
    }

    const following = await followingQuery
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Filter out null results (from populate match)
    const filteredFollowing = following.filter((f) => f.userId !== null);

    // Normalize ID for consistent map keys (ObjectId or string)
    const toIdStr = (id) => (id && typeof id === "object" && id.toString ? id.toString() : String(id));

    // Get following user IDs to check follow status (people in the list)
    const followingIds = filteredFollowing.map((f) => toIdStr(f.userId._id));

    // Check which of these users the current user is following (status = "following")
    const followingMap = new Map();
    if (currentUserId && followingIds.length > 0) {
      let objectIds;
      try {
        objectIds = followingIds.map((id) => new mongoose.Types.ObjectId(id));
      } catch (_) {
        objectIds = followingIds;
      }
      const followingRelations = await UserFollower.find({
        userId: { $in: objectIds },
        followerId: currentUserId,
      })
        .select("userId")
        .lean();

      followingRelations.forEach((rel) => {
        const id = rel.userId ? toIdStr(rel.userId) : null;
        if (id) followingMap.set(id, true);
      });
    }

    // Get total count (with search filter if provided)
    let total;
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      const allFollowing = await UserFollower.find({ followerId: userId }).populate({
        path: "userId",
        select: "username",
        match: { username: searchRegex, isDeleted: false },
      });
      total = allFollowing.filter((f) => f.userId !== null).length;
    } else {
      total = await UserFollower.countDocuments({ followerId: userId });
    }

    const currentUserIdStr = currentUserId ? toIdStr(currentUserId) : null;

    return {
      following: filteredFollowing.map((f) => {
        const fid = toIdStr(f.userId._id);
        let status = "not_following";
        if (currentUserIdStr && fid === currentUserIdStr) {
          status = "self";
        } else if (currentUserIdStr && followingMap.has(fid)) {
          status = "following";
        }

        return {
          id: fid,
          username: f.userId.username,
          name: f.userId.name,
          profileImage: f.userId.profileImage,
          bio: f.userId.bio,
          isVerifiedBadge: f.userId.isVerifiedBadge,
          followedAt: f.createdAt,
          status,
        };
      }),
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getFollowing:", error);
    throw error;
  }
};

/**
 * Get follower and following counts for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Follower and following counts
 */
export const getFollowCounts = async (userId) => {
  try {
    // Validate user exists
    const user = await User.findOne({
      _id: userId,
      isDeleted: false,
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Get counts from UserFollower collection (more accurate than cached counts)
    const followerCount = await UserFollower.countDocuments({ userId });
    const followingCount = await UserFollower.countDocuments({ followerId: userId });

    return {
      userId: user._id.toString(),
      username: user.username,
      name: user.name,
      followerCount,
      followingCount,
    };
  } catch (error) {
    logger.error("Error in getFollowCounts:", error);
    throw error;
  }
};

export default {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
  getFollowCounts,
};

