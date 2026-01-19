/**
 * Follow Controller
 * Handles follow/unfollow HTTP requests
 */

import {
  followUser,
  unfollowUser,
  isFollowing,
  getFollowers,
  getFollowing,
  getFollowCounts,
} from "../services/follow.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Follow a user
 * @route POST /api/v1/follow/:userId
 * @access Private
 */
export const follow = async (req, res) => {
  try {
    const followerId = req.user._id.toString();
    const { userId: targetUserId } = req.params;

    // Follow user
    const result = await followUser(followerId, targetUserId);

    return sendSuccess(
      res,
      {
        followRelation: result.followRelation,
        targetUser: result.targetUser,
        follower: result.follower,
      },
      "User followed successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Follow error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to follow user",
      "Follow Error",
      error.message || "An error occurred while following user",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Unfollow a user
 * @route DELETE /api/v1/follow/:userId
 * @access Private
 */
export const unfollow = async (req, res) => {
  try {
    const followerId = req.user._id.toString();
    const { userId: targetUserId } = req.params;

    // Unfollow user
    const result = await unfollowUser(followerId, targetUserId);

    return sendSuccess(
      res,
      {
        targetUser: result.targetUser,
        follower: result.follower,
      },
      "User unfollowed successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Unfollow error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to unfollow user",
      "Unfollow Error",
      error.message || "An error occurred while unfollowing user",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Check if following a user
 * @route GET /api/v1/follow/:userId/status
 * @access Private
 */
export const getFollowStatus = async (req, res) => {
  try {
    const followerId = req.user._id.toString();
    const { userId: targetUserId } = req.params;

    // Check if following
    const following = await isFollowing(followerId, targetUserId);

    return sendSuccess(
      res,
      {
        userId: targetUserId,
        isFollowing: following,
      },
      "Follow status retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get follow status error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get follow status",
      "Status Error",
      error.message || "An error occurred while retrieving follow status",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get followers list
 * @route GET /api/v1/follow/followers
 * @access Private
 */
export const getFollowersList = async (req, res) => {
  try {
    // If userId is "me" or not provided, use current user's ID
    let userId = req.query.userId;
    if (!userId || userId === "me") {
      userId = req.user._id.toString();
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || null;
    const currentUserId = req.user._id.toString();

    // Get followers
    const result = await getFollowers(userId, currentUserId, page, limit, search);

    return sendSuccess(
      res,
      result,
      "Followers retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get followers error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get followers",
      "Followers Error",
      error.message || "An error occurred while retrieving followers",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get following list
 * @route GET /api/v1/follow/following
 * @access Private
 */
export const getFollowingList = async (req, res) => {
  try {
    // If userId is "me" or not provided, use current user's ID
    let userId = req.query.userId;
    if (!userId || userId === "me") {
      userId = req.user._id.toString();
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || null;
    const currentUserId = req.user._id.toString();

    // Get following
    const result = await getFollowing(userId, currentUserId, page, limit, search);

    return sendSuccess(
      res,
      result,
      "Following retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get following error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get following",
      "Following Error",
      error.message || "An error occurred while retrieving following",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get follower and following counts
 * @route GET /api/v1/follow/count
 * @access Private
 */
export const getFollowCountsList = async (req, res) => {
  try {
    // If userId is "me" or not provided, use current user's ID
    let userId = req.query.userId;
    if (!userId || userId === "me") {
      userId = req.user._id.toString();
    }

    // Get counts
    const result = await getFollowCounts(userId);

    return sendSuccess(
      res,
      result,
      "Follow counts retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get follow counts error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get follow counts",
      "Follow Counts Error",
      error.message || "An error occurred while retrieving follow counts",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  follow,
  unfollow,
  getFollowStatus,
  getFollowersList,
  getFollowingList,
  getFollowCountsList,
};

