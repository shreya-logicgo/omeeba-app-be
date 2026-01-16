/**
 * User Controller
 * HTTP request handlers for user operations
 */

import { searchUsersByUsername } from "../services/user.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
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
    const result = await searchUsersByUsername(searchTerm, currentUserId, page, limit);

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
      "Failed to search users",
      "User Search Error",
      error.message || "An error occurred while searching users",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  searchUsers,
};

