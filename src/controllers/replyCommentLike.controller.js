/**
 * Reply Comment Like Controller
 * Handles reply comment like-related HTTP requests
 */

import { toggleReplyCommentLike } from "../services/replyCommentLike.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Toggle Reply Comment Like
 * @route POST /api/v1/comments/replies/:replyId/like
 * @access Private
 */
export const toggleReplyLike = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { replyId } = req.params;

    const result = await toggleReplyCommentLike(userId, replyId);

    return sendSuccess(
      res,
      result,
      result.isLiked ? "Reply liked successfully" : "Reply unliked successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Toggle reply like error:", error);

    if (error.message === "Reply not found" || error.message === "User not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to toggle reply like",
      "Toggle Reply Like Error",
      error.message || "An error occurred while toggling reply like",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  toggleReplyLike,
};

