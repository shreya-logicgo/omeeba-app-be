/**
 * Comment Reply Controller
 * Handles comment reply-related HTTP requests
 */

import {
  createReply,
  getReplies,
  createReplyToReply,
  getRepliesToReply,
  deleteReply,
} from "../services/commentReply.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
  sendPaginated,
} from "../utils/response.js";
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

    return sendPaginated(
      res,
      result.replies,
      result.pagination,
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

/**
 * Delete Reply
 * @route DELETE /api/v1/comments/replies/:replyId
 * @access Private
 */
export const deleteReplyHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { replyId } = req.params;

    const result = await deleteReply(userId, replyId);

    return sendSuccess(res, result, "Reply deleted successfully", StatusCodes.OK);
  } catch (error) {
    logger.error("Delete reply error:", error);

    if (error.message === "Reply not found" || error.message === "User not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message === "You can only delete your own replies") {
      return sendForbidden(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to delete reply",
      "Delete Reply Error",
      error.message || "An error occurred while deleting reply",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Create reply to a reply (nested reply)
 * @route POST /api/v1/comments/replies/:replyId/replies
 * @access Private
 */
export const createReplyToReplyHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { replyId } = req.params;
    const { reply } = req.body;

    const replyData = await createReplyToReply(userId, replyId, reply);

    return sendSuccess(
      res,
      { reply: replyData },
      "Reply created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create reply-to-reply error:", error);

    if (error.message === "Reply not found" || error.message === "User not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

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
 * Get replies to a reply (nested replies)
 * @route GET /api/v1/comments/replies/:replyId/replies
 * @access Private
 */
export const getRepliesToReplyHandler = async (req, res) => {
  try {
    const { replyId } = req.params;
    const currentUserId = req.user._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await getRepliesToReply(replyId, currentUserId, page, limit);

    return sendPaginated(
      res,
      result.replies,
      result.pagination,
      "Replies retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get replies-to-reply error:", error);

    if (error.message === "Reply not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

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
  deleteReplyHandler,
  createReplyToReplyHandler,
  getRepliesToReplyHandler,
};
