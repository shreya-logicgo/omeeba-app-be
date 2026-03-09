/**
 * Comment Report Controller
 * Handles comment and reply comment report HTTP requests
 */

import { createCommentReport, createReplyCommentReport } from "../services/commentReport.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Report Comment
 * @route POST /api/v1/comments/:commentId/report
 * @access Private
 */
export const reportCommentHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { commentId } = req.params;
    const reportData = req.body;

    // Create report
    const report = await createCommentReport(userId, commentId, reportData);

    return sendSuccess(
      res,
      { report },
      "Comment reported successfully. This comment has been hidden from your view and will no longer appear in your comment listings.",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Report comment error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to report comment",
      "Report Comment Error",
      error.message || "An error occurred while reporting comment",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Report Reply Comment
 * @route POST /api/v1/comments/replies/:replyId/report
 * @access Private
 */
export const reportReplyCommentHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { replyId } = req.params;
    const reportData = req.body;

    const report = await createReplyCommentReport(userId, replyId, reportData);

    return sendSuccess(
      res,
      { report },
      "Reply reported successfully. This reply has been hidden from your view and will no longer appear in your comment replies.",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Report reply comment error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to report reply",
      "Report Reply Comment Error",
      error.message || "An error occurred while reporting reply",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  reportCommentHandler,
  reportReplyCommentHandler,
};

