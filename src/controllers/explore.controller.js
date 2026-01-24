/**
 * Explore Controller
 * Handles HTTP requests for Explore landing screen
 */

import {
  getTrendingContent,
  getContentByHashtag,
  simplifiedSearch,
} from "../services/explore.service.js";
import { sendPaginated, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { getPagination } from "../utils/pagination.js";

/**
 * Get Trending Content
 * @route GET /api/v1/explore/trending
 * @access Private (optional - can work without auth for public explore)
 */
export const getTrending = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const { page, limit } = getPagination(req);
    const { contentType = "all" } = req.query;

    // Validate contentType
    const validContentTypes = ["all", "post", "write", "zeal"];
    if (!validContentTypes.includes(contentType)) {
      return sendError(
        res,
        "Invalid contentType. Must be one of: all, post, write, zeal",
        "Validation Error",
        "Invalid contentType parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Get trending content
    const result = await getTrendingContent(userId, {
      page,
      limit,
      contentType,
    });

    return sendPaginated(
      res,
      result.content,
      result.pagination,
      "Trending content retrieved successfully"
    );
  } catch (error) {
    logger.error("Get trending content error:", error);

    return sendError(
      res,
      "Failed to retrieve trending content",
      "Explore Error",
      error.message || "An error occurred while retrieving trending content",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Search Across Multiple Entities (Simplified)
 * @route GET /api/v1/explore/search
 * @access Private (optional - can work without auth for public explore)
 */
export const search = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const { query = "", type, contentType } = req.query;

    // Validate type
    const validTypes = ["explore", "trending", "polls", "users", "hashtag"];
    if (!validTypes.includes(type)) {
      return sendError(
        res,
        "Invalid type. Must be one of: explore, trending, polls, users, hashtag",
        "Validation Error",
        "Invalid type parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Validate contentType for explore type
    if (type === "explore" && contentType) {
      const validContentTypes = ["zeal", "post"];
      if (!validContentTypes.includes(contentType)) {
        return sendError(
          res,
          "Invalid contentType. Must be one of: zeal, post (only for explore type)",
          "Validation Error",
          "Invalid contentType parameter",
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Perform simplified search
    const result = await simplifiedSearch(userId, {
      query,
      type,
      contentType,
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Search results retrieved successfully",
      data: result.data || [],
    });
  } catch (error) {
    logger.error("Search error:", error);

    return sendError(
      res,
      "Failed to perform search",
      "Search Error",
      error.message || "An error occurred while performing search",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Content by Hashtag
 * @route GET /api/v1/explore/hashtag/:hashtag
 * @access Private (optional - can work without auth for public explore)
 */
export const getHashtagContent = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const { page, limit } = getPagination(req);
    const { hashtag } = req.params;
    const { contentType = "all", sortBy = "popularity" } = req.query;

    // Validate contentType
    const validContentTypes = ["all", "post", "write", "zeal", "poll"];
    if (!validContentTypes.includes(contentType)) {
      return sendError(
        res,
        "Invalid contentType. Must be one of: all, post, write, zeal, poll",
        "Validation Error",
        "Invalid contentType parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Validate sortBy
    const validSortBy = ["relevance", "popularity", "recent"];
    if (!validSortBy.includes(sortBy)) {
      return sendError(
        res,
        "Invalid sortBy. Must be one of: relevance, popularity, recent",
        "Validation Error",
        "Invalid sortBy parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Get content by hashtag
    const result = await getContentByHashtag(userId, {
      hashtag,
      contentType,
      sortBy,
      page,
      limit,
    });

    return res.status(StatusCodes.OK).json({
      success: true,
      message: `Content for ${result.hashtag} retrieved successfully`,
      data: result.content || [],
      pagination: {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total,
        pages: result.pagination.pages,
        hasNext: result.pagination.hasNext || false,
        hasPrev: result.pagination.hasPrev || false,
      },
    });
  } catch (error) {
    logger.error("Get hashtag content error:", error);

    return sendError(
      res,
      "Failed to retrieve hashtag content",
      "Hashtag Error",
      error.message || "An error occurred while retrieving hashtag content",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getTrending,
  search,
  getHashtagContent,
};

