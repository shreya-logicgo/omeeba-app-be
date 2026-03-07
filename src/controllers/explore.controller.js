/**
 * Explore Controller
 * Handles HTTP requests for Explore landing screen
 */

import {
  getTrendingContent,
  getContentByHashtag,
  simplifiedSearch,
} from "../services/explore.service.js";
import { sendPaginated, sendError, sendSuccess } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { getPagination } from "../utils/pagination.js";

/**
 * Get Trending Content
 * @route GET /api/v1/explore
 * @access Private (optional - can work without auth for public explore)
 */
export const getTrending = async (req, res) => {
  try {
    const userId = req.user?._id || null;
    const { page, limit } = getPagination(req);
    const { contentType = "all" } = req.query;

    // Validate contentType
    const validContentTypes = ["all", "post", "write", "zeal", "poll", "explore"];
    if (!validContentTypes.includes(contentType)) {
      return sendError(
        res,
        "Invalid contentType. Must be one of: all, post, write, zeal, poll, explore",
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
    const { query = "", type, contentType } = req.body;

    // Validate type
    const validTypes = ["explore", "trending", "polls", "users", "hashtag", "posts", "zeals"];
    if (!validTypes.includes(type)) {
      return sendError(
        res,
        "Invalid type. Must be one of: explore, trending, polls, users, hashtag, posts, zeals",
        "Validation Error",
        "Invalid type parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Map posts and zeals to explore with contentType
    let mappedType = type;
    let mappedContentType = contentType;
    
    if (type === "posts") {
      mappedType = "explore";
      mappedContentType = "post";
    } else if (type === "zeals") {
      mappedType = "explore";
      mappedContentType = "zeal";
    }

    // Validate contentType based on type
    if (mappedContentType) {
      let validContentTypes = [];
      if (mappedType === "explore") {
        validContentTypes = ["post", "zeal"];
      } else if (mappedType === "users") {
        validContentTypes = ["users"];
      } else if (mappedType === "hashtag") {
        validContentTypes = ["hashtag"];
      }

      if (validContentTypes.length > 0 && !validContentTypes.includes(mappedContentType)) {
        return sendError(
          res,
          `Invalid contentType. For type '${type}', contentType must be one of: ${validContentTypes.join(", ")}`,
          "Validation Error",
          "Invalid contentType parameter",
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Perform simplified search
    const result = await simplifiedSearch(userId, {
      query,
      type: mappedType,
      contentType: mappedContentType,
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
    const validContentTypes = ["all", "post", "write", "zeal", "poll", "user"];
    if (!validContentTypes.includes(contentType)) {
      return sendError(
        res,
        "Invalid contentType. Must be one of: all, post, write, zeal, poll, user",
        "Validation Error",
        "Invalid contentType parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Validate sortBy (not used for contentType=user)
    if (contentType !== "user") {
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
    }

    // Get content by hashtag
    const result = await getContentByHashtag(userId, {
      hashtag,
      contentType,
      sortBy,
      page,
      limit,
    });

    // For contentType=user, return without pagination
    if (contentType === "user") {
      return sendSuccess(
        res,
        result.content || [],
        `Users for ${result.hashtag} retrieved successfully`,
        StatusCodes.OK
      );
    }

    return sendPaginated(
      res,
      result.content || [],
      result.pagination,
      `Content for ${result.hashtag} retrieved successfully`,
      StatusCodes.OK
    );
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

