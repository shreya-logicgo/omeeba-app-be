/**
 * Comment Reply Controller
 * Handles comment reply-related HTTP requests
 */

import { createReply, getReplies } from "../services/commentReply.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create Reply
 * @route POST /api/v1/comments/:commentId/replies
 * @access Private
 */
export const createReplyHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { commentId } = req.params;
    const { reply } = req.body;

    // Create reply
    const replyData = await createReply(userId, commentId, reply);

    return sendSuccess(
      res,
      { reply: replyData },
      "Reply created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create reply error:", error);

    // Handle custom errors
    if (error.message === "Comment not found" || error.message === "User not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to create reply",
      "Create Reply Error",
      error.message || "An error occurred while creating reply",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Replies
 * @route GET /api/v1/comments/:commentId/replies
 * @access Private
 */
export const getRepliesHandler = async (req, res) => {
  try {
    const { commentId } = req.params;
    const currentUserId = req.user._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // Get replies
    const result = await getReplies(commentId, currentUserId, page, limit);

    return sendSuccess(
      res,
      result,
      "Replies retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get replies error:", error);

    // Handle custom errors
    if (error.message === "Comment not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get replies",
      "Get Replies Error",
      error.message || "An error occurred while retrieving replies",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  createReplyHandler,
  getRepliesHandler,
};
