/**
 * Comment Deletion Controller
 * Handles comment deletion HTTP requests
 */

import { deleteComment } from "../services/commentDeletion.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound, sendForbidden } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Delete Comment
 * @route DELETE /api/v1/comments/:commentId
 * @access Private
 */
export const deleteCommentHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { commentId } = req.params;

    // Delete comment
    const result = await deleteComment(userId, commentId);

    return sendSuccess(
      res,
      result,
      "Comment deleted successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Delete comment error:", error);

    // Handle custom errors
    if (error.message === "Comment not found" || error.message === "User not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message === "You can only delete your own comments") {
      return sendForbidden(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to delete comment",
      "Delete Comment Error",
      error.message || "An error occurred while deleting comment",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  deleteCommentHandler,
};
