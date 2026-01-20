import {
  shareContent,
  getSharesSentByUser,
  getSharesReceivedByUser,
  getContentShareCount,
} from "../services/content-share.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
  sendPaginated,
} from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { ContentType } from "../models/enums.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";

/**
 * Share content with one or more users
 * @route POST /api/v1/content-shares/share
 * @access Private
 * @body { contentType: string, contentId: string, receiverIds: Array<string> }
 */
export const share = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { contentType, contentId, receiverIds } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate content ID
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    // Validate receiverIds
    if (!Array.isArray(receiverIds) || receiverIds.length === 0) {
      return sendBadRequest(res, "At least one receiver is required");
    }

    // Validate all receiver IDs are valid ObjectIds
    const invalidReceiverIds = receiverIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidReceiverIds.length > 0) {
      return sendBadRequest(
        res,
        `Invalid receiver IDs: ${invalidReceiverIds.join(", ")}`
      );
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);
    const receiverObjectIds = receiverIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Share content
    const result = await shareContent(
      senderId,
      contentType,
      contentObjectId,
      receiverObjectIds
    );

    return sendSuccess(
      res,
      {
        shareCount: result.shareCount,
        receiverIds: result.receiverIds,
        contentType,
        contentId,
      },
      `Content shared successfully with ${result.shareCount} user(s)`,
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Share content error:", error);

    // Handle specific errors
    if (error.message === "Content not found or not accessible") {
      return sendNotFound(res, error.message);
    }

    if (
      error.message === "Invalid content type" ||
      error.message.includes("receiver") ||
      error.message.includes("At least one receiver")
    ) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to share content",
      "Share Content Error",
      error.message || "An error occurred while sharing content",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get shares sent by the logged-in user
 * @route GET /api/v1/content-shares/sent
 * @access Private
 */
export const getSentShares = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit, skip } = getPagination(req);

    // Get shares sent by user
    const result = await getSharesSentByUser(userId, { page, limit });

    // Get pagination metadata
    const pagination = getPaginationMeta(
      result.pagination.total,
      page,
      limit
    );

    return sendPaginated(
      res,
      result.shares,
      pagination,
      "Shares sent retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get sent shares error:", error);

    return sendError(
      res,
      "Failed to get sent shares",
      "Get Sent Shares Error",
      error.message || "An error occurred while retrieving sent shares",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get shares received by the logged-in user
 * @route GET /api/v1/content-shares/received
 * @access Private
 */
export const getReceivedShares = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit, skip } = getPagination(req);

    // Get shares received by user
    const result = await getSharesReceivedByUser(userId, { page, limit });

    // Get pagination metadata
    const pagination = getPaginationMeta(
      result.pagination.total,
      page,
      limit
    );

    return sendPaginated(
      res,
      result.shares,
      pagination,
      "Shares received retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get received shares error:", error);

    return sendError(
      res,
      "Failed to get received shares",
      "Get Received Shares Error",
      error.message || "An error occurred while retrieving received shares",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get share count for specific content
 * @route POST /api/v1/content-shares/count
 * @access Private
 * @body { contentType: string, contentId: string }
 */
export const getShareCount = async (req, res) => {
  try {
    const { contentType, contentId } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate content ID
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);

    // Get share count
    const shareCount = await getContentShareCount(contentType, contentObjectId);

    return sendSuccess(
      res,
      {
        contentType,
        contentId,
        shareCount,
      },
      "Share count retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get share count error:", error);

    return sendError(
      res,
      "Failed to get share count",
      "Get Share Count Error",
      error.message || "An error occurred while retrieving share count",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  share,
  getSentShares,
  getReceivedShares,
  getShareCount,
};

