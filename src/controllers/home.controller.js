/**
 * Home Feed Controller
 * Handles HTTP requests for Home screen feed
 */

import { getHomeFeed as getHomeFeedService } from "../services/explore.service.js";
import { sendPaginated, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { getPagination } from "../utils/pagination.js";

/**
 * Get Home Feed
 * @route GET /api/v1/home
 * @access Private
 */
export const getHomeFeed = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const { page, limit } = getPagination(req);
    const { item } = req.query;

    const result = await getHomeFeedService(userId, { page, limit, item });

    return sendPaginated(
      res,
      result.content,
      result.pagination,
      "Home feed retrieved successfully"
    );
  } catch (error) {
    logger.error("Get home feed error:", error);
    return sendError(
      res,
      "Failed to retrieve home feed",
      "Home Feed Error",
      error.message || "An error occurred while retrieving home feed",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getHomeFeed,
};
