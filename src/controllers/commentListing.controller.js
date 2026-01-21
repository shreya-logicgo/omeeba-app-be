/**
 * Comment Listing Controller
 * Handles comment listing HTTP requests
 */

import { getComments, getCommentById } from "../services/commentListing.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Get Comments for Content
 * @route GET /api/v1/comments
 * @access Private
 */
export const getCommentsHandler = async (req, res) => {
  try {
    const { contentType, contentId } = req.query;
    const currentUserId = req.user._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Get comments
    const result = await getComments(contentType, contentId, currentUserId, page, limit);

    return sendSuccess(
      res,
      result,
      "Comments retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get comments error:", error);

    // Handle custom errors
    if (error.message === "Content not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get comments",
      "Get Comments Error",
      error.message || "An error occurred while retrieving comments",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Comment by ID
 * @route GET /api/v1/comments/:commentId
 * @access Private
 */
export const getCommentByIdHandler = async (req, res) => {
  try {
    const { commentId } = req.params;
    const currentUserId = req.user._id.toString();

    // Get comment
    const comment = await getCommentById(commentId, currentUserId);

    if (!comment) {
      return sendNotFound(res, "Comment not found or has been hidden");
    }

    return sendSuccess(
      res,
      { comment },
      "Comment retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get comment by ID error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get comment",
      "Get Comment Error",
      error.message || "An error occurred while retrieving comment",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getCommentsHandler,
  getCommentByIdHandler,
};
