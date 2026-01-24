/**
 * Snap Controller
 * Handles snap HTTP requests
 */

import {
  createSnap,
  confirmSnapUpload,
  viewSnap,
  getSnapsInbox,
  getSentSnaps,
  deliverSnapToRecipients,
} from "../services/snap.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create Snap
 * @route POST /api/v1/snaps
 * @access Private
 */
export const createSnapHandler = async (req, res) => {
  try {
    const senderId = req.user._id.toString();
    const snapData = req.body;

    const result = await createSnap(senderId, snapData);

    return sendSuccess(
      res,
      result,
      "Snap created successfully. Upload media using the provided URL.",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create snap error:", error);

    if (
      error.message.includes("recipient") ||
      error.message.includes("Invalid") ||
      error.message.includes("Maximum")
    ) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to create snap",
      "Create Snap Error",
      error.message || "An error occurred while creating snap",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Confirm Snap Upload
 * @route POST /api/v1/snaps/:snapId/confirm
 * @access Private
 */
export const confirmSnapUploadHandler = async (req, res) => {
  try {
    const { snapId } = req.params;
    const userId = req.user._id.toString();

    const snap = await confirmSnapUpload(snapId, userId);

    // Deliver snap to recipients' inboxes
    try {
      await deliverSnapToRecipients(snapId, userId);
    } catch (deliveryError) {
      logger.error("Error delivering snap to recipients:", deliveryError);
      // Don't fail the request if delivery fails, snap is still created
    }

    return sendSuccess(
      res,
      { snap },
      "Snap uploaded and delivered successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Confirm snap upload error:", error);

    if (
      error.message === "Snap not found" ||
      error.message.includes("Unauthorized") ||
      error.message.includes("not found in storage")
    ) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to confirm snap upload",
      "Confirm Upload Error",
      error.message || "An error occurred while confirming upload",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * View Snap
 * @route GET /api/v1/snaps/:snapId/view
 * @access Private
 */
export const viewSnapHandler = async (req, res) => {
  try {
    const { snapId } = req.params;
    const userId = req.user._id.toString();

    const result = await viewSnap(snapId, userId);

    return sendSuccess(
      res,
      result,
      "Snap retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("View snap error:", error);

    if (
      error.message === "Snap not found" ||
      error.message === "Snap has expired" ||
      error.message.includes("Unauthorized")
    ) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to view snap",
      "View Snap Error",
      error.message || "An error occurred while viewing snap",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Snaps Inbox
 * @route GET /api/v1/snaps/inbox
 * @access Private
 */
export const getSnapsInboxHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { page, limit, includeExpired } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      includeExpired: includeExpired === "true",
    };

    const result = await getSnapsInbox(userId, options);

    return sendSuccess(
      res,
      result,
      "Snaps retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get snaps inbox error:", error);

    return sendError(
      res,
      "Failed to retrieve snaps",
      "Get Snaps Error",
      error.message || "An error occurred while retrieving snaps",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Sent Snaps
 * @route GET /api/v1/snaps/sent
 * @access Private
 */
export const getSentSnapsHandler = async (req, res) => {
  try {
    const senderId = req.user._id.toString();
    const { page, limit } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
    };

    const result = await getSentSnaps(senderId, options);

    return sendSuccess(
      res,
      result,
      "Sent snaps retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get sent snaps error:", error);

    return sendError(
      res,
      "Failed to retrieve sent snaps",
      "Get Sent Snaps Error",
      error.message || "An error occurred while retrieving sent snaps",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
