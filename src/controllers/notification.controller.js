/**
 * Notification Controller
 * Handles HTTP requests for notifications
 */

import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
} from "../services/notification.service.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { getPagination } from "../utils/pagination.js";

/**
 * Get Notifications
 * @route GET /api/v1/notifications
 * @access Private
 */
export const getNotificationsList = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page, limit } = getPagination(req);
    const { status = "all", type = null } = req.query;

    // Validate status
    const validStatuses = ["all", "unread", "read"];
    if (!validStatuses.includes(status)) {
      return sendError(
        res,
        "Invalid status. Must be one of: all, unread, read",
        "Validation Error",
        "Invalid status parameter",
        StatusCodes.BAD_REQUEST
      );
    }

    // Get notifications
    const result = await getNotifications(userId, {
      page,
      limit,
      status,
      type,
    });

    return sendPaginated(
      res,
      result.notifications,
      result.pagination,
      "Notifications retrieved successfully"
    );
  } catch (error) {
    logger.error("Get notifications error:", error);

    return sendError(
      res,
      "Failed to retrieve notifications",
      "Notification Error",
      error.message || "An error occurred while retrieving notifications",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Unread Notification Count
 * @route GET /api/v1/notifications/unread-count
 * @access Private
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await getUnreadNotificationCount(userId);

    return sendSuccess(
      res,
      { unreadCount: count },
      "Unread notification count retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get unread count error:", error);

    return sendError(
      res,
      "Failed to retrieve unread notification count",
      "Notification Error",
      error.message || "An error occurred while retrieving unread count",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Mark Notification as Read
 * @route PUT /api/v1/notifications/:notificationId/read
 * @access Private
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    const notification = await markNotificationAsRead(notificationId, userId);

    return sendSuccess(
      res,
      {
        notification: {
          id: notification._id.toString(),
          status: notification.status,
        },
      },
      "Notification marked as read",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Mark notification as read error:", error);

    if (error.message === "Notification not found") {
      return sendError(
        res,
        "Notification not found",
        "Not Found",
        error.message,
        StatusCodes.NOT_FOUND
      );
    }

    return sendError(
      res,
      "Failed to mark notification as read",
      "Notification Error",
      error.message || "An error occurred while marking notification as read",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Mark All Notifications as Read
 * @route PUT /api/v1/notifications/read-all
 * @access Private
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await markAllNotificationsAsRead(userId);

    return sendSuccess(
      res,
      {
        modifiedCount: result.modifiedCount || 0,
      },
      "All notifications marked as read",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Mark all notifications as read error:", error);

    return sendError(
      res,
      "Failed to mark all notifications as read",
      "Notification Error",
      error.message || "An error occurred while marking all notifications as read",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Delete Notification
 * @route DELETE /api/v1/notifications/:notificationId
 * @access Private
 */
export const deleteNotificationById = async (req, res) => {
  try {
    const userId = req.user._id;
    const { notificationId } = req.params;

    await deleteNotification(notificationId, userId);

    return sendSuccess(
      res,
      null,
      "Notification deleted successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Delete notification error:", error);

    if (error.message === "Notification not found") {
      return sendError(
        res,
        "Notification not found",
        "Not Found",
        error.message,
        StatusCodes.NOT_FOUND
      );
    }

    return sendError(
      res,
      "Failed to delete notification",
      "Notification Error",
      error.message || "An error occurred while deleting notification",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getNotificationsList,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotificationById,
};

