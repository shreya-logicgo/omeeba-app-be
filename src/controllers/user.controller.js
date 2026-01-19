import {
  updateProfile as updateProfileService,
  getUserProfile as getUserProfileService,
} from "../services/user.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
} from "../utils/response.js";
import { searchUsersByUsername } from "../services/user.service.js";
import { StatusCodes } from "http-status-codes";
/**
 * User Controller
 * HTTP request handlers for user operations
 */

import logger from "../utils/logger.js";

/**
 * Update Profile
 * @route PUT /api/v1/users/profile
 * @access Private
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    // Update profile
    const user = await updateProfileService(userId, updateData);

    // Return success response
    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          bio: user.bio,
          profileImage: user.profileImage,
          coverImage: user.coverImage,
          isAccountVerified: user.isAccountVerified,
          isVerifiedBadge: user.isVerifiedBadge,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      "Profile updated successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Update profile error:", error);
  }
};

/*
 * Search users by username
 * @route GET /api/v1/users/search
 * @access Private
 */
export const searchUsers = async (req, res) => {
  try {
    const searchTerm = req.query.username || req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const currentUserId = req.user._id.toString();

    // Get search results
    const result = await searchUsersByUsername(
      searchTerm,
      currentUserId,
      page,
      limit
    );

    return sendSuccess(
      res,
      result,
      "Users retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Search users error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to update profile",
      "Update Profile Error",
      error.message || "An error occurred while updating profile",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get User Profile
 * @route GET /api/v1/users/:userId/profile
 * @route GET /api/v1/users/profile (for own profile)
 * @access Private (for own profile) / Public (for other users)
 */
export const getUserProfile = async (req, res) => {
  try {
    // Get userId from params or use authenticated user's ID
    const targetUserId = req.params.userId || req.user._id.toString();
    const viewerId = req.user ? req.user._id.toString() : null;

    // Get profile
    const profile = await getUserProfileService(targetUserId, viewerId);

    // Return success response
    return sendSuccess(
      res,
      {
        profile,
      },
      "Profile retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get user profile error:", error);

    // Handle custom errors
    if (
      error.message === "User not found" ||
      error.message === "User account has been deleted"
    ) {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get profile",
      "Get Profile Error",
      error.message || "An error occurred while retrieving profile",
      "Failed to search users",
      "User Search Error",
      error.message || "An error occurred while searching users",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  updateProfile,
  getUserProfile,
  searchUsers,
};
