/**
 * Hashtag Controller
 * Handles HTTP requests for hashtag operations
 */

import { getTrendingHashtags } from "../services/hashtag.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Get Trending Hashtags
 * @route GET /api/v1/hashtags/trending
 * @access Public (optional auth)
 */
export const getTrending = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Validate limit
    if (limit < 1 || limit > 50) {
      return sendError(
        res,
        "Limit must be between 1 and 50",
        "Validation Error",
        "Invalid limit parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Get trending hashtags
    const hashtags = await getTrendingHashtags(limit);

    return sendSuccess(
      res,
      {
        hashtags,
      },
      "Trending hashtags retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get trending hashtags error:", error);

    return sendError(
      res,
      "Failed to retrieve trending hashtags",
      "Hashtag Error",
      error.message || "An error occurred while retrieving trending hashtags",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getTrending,
};

