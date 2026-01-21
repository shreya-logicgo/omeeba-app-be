import User from "../models/users/User.js";
import UserFollower from "../models/users/UserFollower.js";
import Post from "../models/content/Post.js";
import WritePost from "../models/content/WritePost.js";
import ZealPost from "../models/content/ZealPost.js";
import Poll from "../models/content/Poll.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";

/**
 * Update User Profile
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update (name, username, bio, profileImage, coverImage)
 * @returns {Promise<Object>} Updated user (without password and sensitive data)
 */
export const updateProfile = async (userId, updateData) => {
  try {
    // Find user
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Prepare update object (only include provided fields)
    const updateFields = {};

    if (updateData.name !== undefined) {
      updateFields.name = updateData.name.trim();
    }

    if (updateData.username !== undefined) {
      const newUsername = updateData.username.trim().toLowerCase();

      // Check if username is different from current
      if (newUsername !== user.username) {
        // Check if username already exists
        const existingUser = await User.findOne({
          username: newUsername,
          _id: { $ne: userId },
          isDeleted: false,
        });

        if (existingUser) {
          throw new Error(
            "Username is already taken. Please choose another one"
          );
        }

        updateFields.username = newUsername;
      }
    }

    if (updateData.bio !== undefined) {
      updateFields.bio = updateData.bio.trim();
    }

    if (updateData.profileImage !== undefined) {
      updateFields.profileImage = updateData.profileImage || null;
    }

    if (updateData.coverImage !== undefined) {
      updateFields.coverImage = updateData.coverImage || null;
    }

    // Update user
    Object.assign(user, updateFields);
    await user.save();

    logger.info(`Profile updated for user ${user.email}`);

    // Return user without password and sensitive data
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.otp;
    delete userObject.otpExpireAt;
    delete userObject.forgotPasswordOTP;
    delete userObject.forgotPasswordOTPExpireAt;
    delete userObject.forgotPasswordOTPVerified;
    delete userObject.forgotPasswordOTPVerifiedAt;

    return userObject;
  } catch (error) {
    logger.error("Error in updateProfile:", error);
    throw error;
  }
};

/**
 * Get User Profile
 * @param {string} userId - User ID to get profile for
 * @param {string} viewerId - ID of user viewing the profile (optional, for follow status)
 * @returns {Promise<Object>} User profile with counts and follow status
 */
export const getUserProfile = async (userId, viewerId = null) => {
  try {
    // Find user
    const user = await User.findById(userId).select(
      "-password -otp -otpExpireAt -forgotPasswordOTP -forgotPasswordOTPExpireAt -forgotPasswordOTPVerified -forgotPasswordOTPVerifiedAt"
    );

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Get followers count (people who follow this user)
    // userId = target user, followerId = people who follow
    const followersCount = await UserFollower.countDocuments({
      userId: userId,
    });

    // Get following count (people this user follows)
    // followerId = target user, userId = people they follow
    const followingCount = await UserFollower.countDocuments({
      followerId: userId,
    });

    // Get content counts
    const [postsCount, writePostsCount, zealPostsCount, pollsCount] =
      await Promise.all([
        Post.countDocuments({ userId: userId }),
        WritePost.countDocuments({ userId: userId }),
        ZealPost.countDocuments({ userId: userId }),
        Poll.countDocuments({ createdBy: userId }), // Poll uses createdBy instead of userId
      ]);

    const totalContentCount =
      postsCount + writePostsCount + zealPostsCount + pollsCount;

    // Get follow relationship status if viewer is provided and different from profile user
    let followStatus = null;
    if (viewerId && viewerId.toString() !== userId.toString()) {
      const followRelation = await UserFollower.findOne({
        userId: userId, // Profile user
        followerId: viewerId, // Viewer (person viewing the profile)
      });

      followStatus = followRelation ? "following" : "not_following";
    }

    // Build profile response
    const profile = {
      id: user._id,
      name: user.name,
      username: user.username,
      profileImage: user.profileImage,
      coverImage: user.coverImage,
      bio: user.bio,
      isVerifiedBadge: user.isVerifiedBadge,
      isAccountVerified: user.isAccountVerified,
      followersCount,
      followingCount,
      contentCounts: {
        posts: postsCount,
        writePosts: writePostsCount,
        zealPosts: zealPostsCount,
        polls: pollsCount,
        total: totalContentCount,
      },
      followStatus, // null if viewing own profile or not authenticated
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    logger.info(
      `Profile retrieved for user ${userId} by viewer ${viewerId || "self"}`
    );

    return profile;
  } catch (error) {
    logger.error("Error in getUserProfile:", error);
    throw error;
  }
};

/**
 * Search users by username
 * @param {string} searchTerm - Username search term
 * @param {string} currentUserId - Current authenticated user ID (to check follow status)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @returns {Promise<Object>} Users list with pagination
 */
export const searchUsersByUsername = async (
  searchTerm,
  currentUserId,
  page = 1,
  limit = 20
) => {
  try {
    if (!searchTerm || !searchTerm.trim()) {
      return {
        users: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const skip = (page - 1) * limit;
    const searchRegex = new RegExp(searchTerm.trim(), "i"); // Case-insensitive search

    // Build query to exclude current user and deleted users
    const query = {
      username: searchRegex,
      isDeleted: false,
    };

    // Exclude current user from search results
    if (currentUserId) {
      query._id = { $ne: new mongoose.Types.ObjectId(currentUserId) };
    }

    // Search users by username (excluding deleted users and current user)
    const users = await User.find(query)
      .select(
        "username name profileImage bio isVerifiedBadge followerCount followingCount"
      )
      .sort({ username: 1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    // Get user IDs to check follow status
    const userIds = users.map((u) => u._id.toString());

    // Check which users the current user is following
    let followingMap = new Map();
    if (currentUserId && userIds.length > 0) {
      const followingRelations = await UserFollower.find({
        userId: { $in: userIds },
        followerId: currentUserId,
      });

      followingRelations.forEach((rel) => {
        followingMap.set(rel.userId.toString(), true);
      });
    }

    return {
      users: users.map((user) => {
        const userId = user._id.toString();
        const isFollowing = currentUserId ? followingMap.has(userId) : false;

        return {
          id: userId,
          username: user.username,
          name: user.name,
          profileImage: user.profileImage,
          bio: user.bio,
          isVerifiedBadge: user.isVerifiedBadge,
          followerCount: user.followerCount,
          followingCount: user.followingCount,
          status: isFollowing ? "following" : "not_following",
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error in searchUsersByUsername:", error);
    throw error;
  }
};

/**
 * Search users for mention autocomplete
 * Optimized for @username autocomplete suggestions
 * @param {string} searchTerm - Username search term (without @)
 * @param {string} currentUserId - Current authenticated user ID (to exclude from results)
 * @param {number} limit - Maximum results (default: 10, max: 20)
 * @returns {Promise<Array>} Array of user objects with minimal data
 */
export const searchUsersForMentions = async (
  searchTerm,
  currentUserId,
  limit = 10
) => {
  try {
    // Limit max results to 20 for performance
    const maxLimit = Math.min(limit, 20);
    
    if (!searchTerm || !searchTerm.trim()) {
      return [];
    }

    const searchQuery = searchTerm.trim().toLowerCase();
    
    // Build query - search from beginning of username for better autocomplete
    const query = {
      username: new RegExp(`^${searchQuery}`, "i"), // Starts with search term (case-insensitive)
      isDeleted: false,
    };

    // Exclude current user from results
    if (currentUserId) {
      query._id = { $ne: new mongoose.Types.ObjectId(currentUserId) };
    }

    // Search users - optimized query with minimal fields
    const users = await User.find(query)
      .select("username name profileImage isVerifiedBadge")
      .sort({ username: 1 }) // Sort alphabetically
      .limit(maxLimit)
      .lean();

    // Format response with minimal data needed for autocomplete
    return users.map((user) => ({
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      profileImage: user.profileImage,
      isVerifiedBadge: user.isVerifiedBadge,
    }));
  } catch (error) {
    logger.error("Error in searchUsersForMentions:", error);
    throw error;
  }
};

export default {
  updateProfile,
  getUserProfile,
  searchUsersByUsername,
  searchUsersForMentions,
};
