import User from "../models/users/User.js";
import UserFollower from "../models/users/UserFollower.js";
import ChatRoom from "../models/chat/ChatRoom.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * Get blocked user IDs (users who blocked sender or are blocked by sender)
 * @param {mongoose.Types.ObjectId} senderId - Sender user ID
 * @returns {Promise<Array<mongoose.Types.ObjectId>>} Array of blocked user IDs
 */
const getBlockedUserIds = async (senderId) => {
  try {
    // Find chat rooms where sender is blocked or has blocked someone
    const blockedRooms = await ChatRoom.find({
      $or: [
        { userA: senderId, isBlocked: true },
        { userB: senderId, isBlocked: true },
      ],
    }).select("userA userB");

    const blockedUserIds = new Set();

    blockedRooms.forEach((room) => {
      if (room.userA.toString() === senderId.toString()) {
        blockedUserIds.add(room.userB.toString());
      } else {
        blockedUserIds.add(room.userA.toString());
      }
    });

    return Array.from(blockedUserIds).map((id) => new mongoose.Types.ObjectId(id));
  } catch (error) {
    logger.error("Error getting blocked user IDs:", error);
    return [];
  }
};

/**
 * Get eligible users for content sharing
 * Includes: followers, following, and searchable users
 * Excludes: blocked users, deleted users, and sender
 * @param {mongoose.Types.ObjectId} senderId - Sender user ID
 * @param {Object} options - Query options
 * @param {string} options.search - Search term for username/name (optional)
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @param {string} options.type - Filter type: 'all', 'followers', 'following', 'searchable' (default: 'all')
 * @returns {Promise<Object>} Eligible users with pagination
 */
export const getEligibleUsersForSharing = async (senderId, options = {}) => {
  try {
    const {
      search = "",
      page = 1,
      limit = 20,
      type = "all", // 'all', 'followers', 'following', 'searchable'
    } = options;

    const skip = (page - 1) * limit;

    // Get blocked user IDs
    const blockedUserIds = await getBlockedUserIds(senderId);

    // Base query to exclude blocked users, deleted users, and sender
    const baseExcludeQuery = {
      _id: {
        $ne: senderId, // Exclude sender
        $nin: blockedUserIds, // Exclude blocked users
      },
      isDeleted: false, // Exclude deleted users
    };

    let eligibleUserIds = new Set();
    let userQuery = { ...baseExcludeQuery };

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      userQuery.$or = [
        { username: searchRegex },
        { name: searchRegex },
      ];
    }

    // Get eligible users based on type
    if (type === "followers" || type === "all") {
      // Get followers (users who follow the sender)
      const followers = await UserFollower.find({
        userId: senderId,
      }).select("followerId");

      followers.forEach((f) => {
        const followerId = f.followerId.toString();
        if (!blockedUserIds.some((id) => id.toString() === followerId)) {
          eligibleUserIds.add(followerId);
        }
      });
    }

    if (type === "following" || type === "all") {
      // Get following (users the sender follows)
      const following = await UserFollower.find({
        followerId: senderId,
      }).select("userId");

      following.forEach((f) => {
        const userId = f.userId.toString();
        if (!blockedUserIds.some((id) => id.toString() === userId)) {
          eligibleUserIds.add(userId);
        }
      });
    }

    if (type === "searchable" || type === "all") {
      // For searchable, we'll include all non-blocked users in the search
      // This allows sharing with any user on the platform (if search is provided)
      // If no search is provided and type is 'searchable', return empty or limit results
      if (search && search.trim()) {
        // Search will be handled in the main query
      } else if (type === "searchable") {
        // If searchable but no search term, return empty
        return {
          users: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
    }

    // If type is 'followers' or 'following', filter by eligible IDs
    // For 'all' type with followers/following, include them in the search
    // For 'searchable', search all non-blocked users
    if (type === "followers" || type === "following") {
      if (eligibleUserIds.size > 0) {
        userQuery._id = {
          ...userQuery._id,
          $in: Array.from(eligibleUserIds).map((id) => new mongoose.Types.ObjectId(id)),
        };
      } else {
        // No eligible users found, return empty
        return {
          users: [],
          pagination: {
            page,
            limit,
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
    } else if (type === "all" && eligibleUserIds.size > 0 && !search) {
      // If 'all' type with no search, prioritize followers and following
      userQuery._id = {
        ...userQuery._id,
        $in: Array.from(eligibleUserIds).map((id) => new mongoose.Types.ObjectId(id)),
      };
    }
    // For 'all' with search or 'searchable', search all eligible users

    // Query users
    const users = await User.find(userQuery)
      .select("username name profileImage bio isAccountVerified isVerifiedBadge")
      .sort({ username: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await User.countDocuments(userQuery);

    // Get user IDs to check follow relationships
    const userIds = users.map((u) => u._id.toString());

    // Check follow relationships
    const [followersMap, followingMap] = await Promise.all([
      // Users who follow the sender
      UserFollower.find({
        userId: senderId,
        followerId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
      }).then((followers) => {
        const map = new Map();
        followers.forEach((f) => {
          map.set(f.followerId.toString(), true);
        });
        return map;
      }),
      // Users the sender follows
      UserFollower.find({
        followerId: senderId,
        userId: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
      }).then((following) => {
        const map = new Map();
        following.forEach((f) => {
          map.set(f.userId.toString(), true);
        });
        return map;
      }),
    ]);

    // Format response
    const formattedUsers = users.map((user) => {
      const userId = user._id.toString();
      const isFollower = followersMap.has(userId);
      const isFollowing = followingMap.has(userId);

      let relationshipStatus = "none";
      if (isFollower && isFollowing) {
        relationshipStatus = "mutual";
      } else if (isFollower) {
        relationshipStatus = "follower";
      } else if (isFollowing) {
        relationshipStatus = "following";
      }

      return {
        id: userId,
        username: user.username,
        name: user.name,
        profileImage: user.profileImage,
        bio: user.bio || "",
        isAccountVerified: user.isAccountVerified || false,
        isVerifiedBadge: user.isVerifiedBadge || false,
        relationshipStatus,
      };
    });

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error("Error in getEligibleUsersForSharing:", error);
    throw error;
  }
};

export default {
  getEligibleUsersForSharing,
};

