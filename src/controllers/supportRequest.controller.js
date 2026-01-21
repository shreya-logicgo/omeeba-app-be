/**
 * Support Request Controller
 * Handles support request HTTP requests
 */

import {
  createSupportRequest,
  getSupportRequests,
} from "../services/supportRequest.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create Support Request
 * @route POST /api/v1/support/requests
 * @access Private
 */
export const createSupportRequestHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const requestData = req.body;

    const supportRequest = await createSupportRequest(userId, requestData);

    return sendSuccess(
      res,
      { supportRequest },
      "Support request created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create support request error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to create support request",
      "Create Support Request Error",
      error.message || "An error occurred while creating support request",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Support Requests
 * @route GET /api/v1/support/requests
 * @access Private
 */
export const getSupportRequestsHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await getSupportRequests(userId, page, limit);

    return sendSuccess(
      res,
      result,
      "Support requests retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get support requests error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get support requests",
      "Get Support Requests Error",
      error.message || "An error occurred while retrieving support requests",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  createSupportRequestHandler,
  getSupportRequestsHandler,
};
