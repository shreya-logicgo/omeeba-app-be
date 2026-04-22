import {
  toggleLikeContent,
  getContentLikeStatus,
  getContentLikedUsers,
} from "../services/content-like.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
} from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { ContentType } from "../models/enums.js";

/**
 * Toggle like status (like if not liked, unlike if liked)
 * @route POST /api/v1/content-likes/toggle
 * @access Private
 * @body { contentType: string, contentId: string }
 */
export const toggle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contentType, contentId } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate content ID
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);

    // Toggle like
    const result = await toggleLikeContent(userId, contentType, contentObjectId);

    return sendSuccess(
      res,
      {
        action: result.action,
        isLiked: result.isLiked,
        likeCount: result.likeCount,
        contentType,
        contentId,
      },
      result.action === "liked"
        ? "Content liked successfully"
        : "Content unliked successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Toggle like error:", error);

    // Handle specific errors
    if (error.message === "Content not found or not accessible") {
      return sendNotFound(res, error.message);
    }

    if (error.message === "Invalid content type") {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to toggle like",
      "Toggle Like Error",
      error.message || "An error occurred while toggling like",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get like status for content
 * @route GET /api/v1/content-likes/:contentType/:contentId/status
 * @access Private
 */
export const getStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contentType, contentId } = req.params;

    // Handle space-less content types in params (e.g., ZealPost -> Zeal Post)
    const normalizedContentType = contentType.toLowerCase().replace(/[\s-_]/g, "") === 'zealpost' 
      ? ContentType.ZEAL 
      : contentType.toLowerCase().replace(/[\s-_]/g, "") === 'writepost' 
        ? ContentType.WRITE_POST 
        : contentType;

    if (!Object.values(ContentType).includes(normalizedContentType)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);

    // Get like status
    const result = await getContentLikeStatus(
      userId,
     normalizedContentType,
      contentObjectId
    );

    return sendSuccess(
      res,
      {
        isLiked: result.isLiked,
        likeCount: result.likeCount,
        contentType : normalizedContentType,
        contentId,
      },
      "Like status retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get like status error:", error);

    // Generic error
    return sendError(
      res,
      "Failed to get like status",
      "Get Like Status Error",
      error.message || "An error occurred while retrieving like status",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
export const getLikedUsers = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const currentUserId = req.user._id;

    const { page = 1, limit = 20 } = req.query;
    const normalizedContentType = contentType.toLowerCase().replace(/[\s-_]/g, "") === 'zealpost' 
      ? ContentType.ZEAL 
      : contentType.toLowerCase().replace(/[\s-_]/g, "") === 'writepost' 
        ? ContentType.WRITE_POST 
        : contentType;


    // Validate content type
    if (!Object.values(ContentType).includes(normalizedContentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const result = await getContentLikedUsers(
      normalizedContentType,
      new mongoose.Types.ObjectId(contentId),
      currentUserId,
      {
        page: Number(page),
        limit: Number(limit),
      }
    );

    console.log("Liked users result:", result);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Liked users fetched successfully",
      data: {
        users: result.users,
      },
      pagination: result.pagination,
    });

  } catch (error) {
    logger.error("getLikedUsers error:", error);

    return sendError(
      res,
      "Failed to fetch liked users",
      "Get Liked Users Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  toggle,
  getStatus,
};

