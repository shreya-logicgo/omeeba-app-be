/**
 * Comment Controller
 * Handles comment-related HTTP requests
 */

import { createComment as createCommentService } from "../services/comment.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create Comment
 * @route POST /api/v1/comments
 * @access Private
 */
export const createComment = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const commentData = req.body;

    // Create comment
    const comment = await createCommentService(userId, commentData);

    return sendSuccess(
      res,
      { comment },
      "Comment created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create comment error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to create comment",
      "Create Comment Error",
      error.message || "An error occurred while creating comment",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  createComment,
};
