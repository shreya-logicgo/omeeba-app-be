/**
 * Comment Report Controller
 * Handles comment report HTTP requests
 */

import { createCommentReport } from "../services/commentReport.service.js";
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

export default {
  reportCommentHandler,
};
