/**
 * User Service
 * Business logic for user search operations
 */

import mongoose from "mongoose";
import User from "../models/users/User.js";
import UserFollower from "../models/users/UserFollower.js";
import logger from "../utils/logger.js";

/**
 * Search users by username
 * @param {string} searchTerm - Username search term
 * @param {string} currentUserId - Current authenticated user ID (to check follow status)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @returns {Promise<Object>} Users list with pagination
 */
export const searchUsersByUsername = async (searchTerm, currentUserId, page = 1, limit = 20) => {
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
      .select("username name profileImage bio isVerifiedBadge followerCount followingCount")
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

export default {
  searchUsersByUsername,
};

