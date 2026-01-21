/**
 * Comment Like Controller
 * Handles comment like-related HTTP requests
 */

import { toggleCommentLike } from "../services/commentLike.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Toggle Comment Like
 * @route POST /api/v1/comments/:commentId/like
 * @access Private
 */
export const toggleLike = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { commentId } = req.params;

    // Toggle like
    const result = await toggleCommentLike(userId, commentId);

    return sendSuccess(
      res,
      result,
      result.isLiked ? "Comment liked successfully" : "Comment unliked successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Toggle comment like error:", error);

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
      "Failed to toggle comment like",
      "Toggle Like Error",
      error.message || "An error occurred while toggling comment like",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  toggleLike,
};
