/**
 * Chat Read Controller
 * Handles read/unread status HTTP requests
 */

import {
  markMessagesAsRead,
  getUnreadCount,
  getTotalUnreadCount,
} from "../services/chatRead.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Mark Messages as Read
 * @route POST /api/v1/chat/rooms/:roomId/read
 * @access Private
 */
export const markMessagesAsReadHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id.toString();
    const { lastReadMessageId } = req.body;

    const result = await markMessagesAsRead(roomId, userId, lastReadMessageId);

    return sendSuccess(
      res,
      result,
      "Messages marked as read successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Mark messages as read error:", error);

    if (error.message === "Chat room not found or access denied" || error.message === "Message not found") {
      return sendBadRequest(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to mark messages as read",
      "Mark Read Error",
      error.message || "An error occurred while marking messages as read",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Unread Count for a Room
 * @route GET /api/v1/chat/rooms/:roomId/unread-count
 * @access Private
 */
export const getUnreadCountHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id.toString();

    const unreadCount = await getUnreadCount(roomId, userId);

    return sendSuccess(
      res,
      { roomId, unreadCount },
      "Unread count retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get unread count error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get unread count",
      "Get Unread Count Error",
      error.message || "An error occurred while retrieving unread count",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Total Unread Count
 * @route GET /api/v1/chat/unread-count
 * @access Private
 */
export const getTotalUnreadCountHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const totalUnreadCount = await getTotalUnreadCount(userId);

    return sendSuccess(
      res,
      { totalUnreadCount },
      "Total unread count retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get total unread count error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get total unread count",
      "Get Total Unread Count Error",
      error.message || "An error occurred while retrieving total unread count",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  markMessagesAsReadHandler,
  getUnreadCountHandler,
  getTotalUnreadCountHandler,
};
