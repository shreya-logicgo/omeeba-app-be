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
  createNotification,
} from "../services/notification.service.js";
import {
  sendPushNotification,
  sendPushNotificationToMultiple,
  sendPushNotificationToAll,
} from "../services/onesignal.service.js";
import User from "../models/users/User.js";
import { sendSuccess, sendError, sendPaginated } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { getPagination } from "../utils/pagination.js";
import mongoose from "mongoose";

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

/**
 * Create and Send Notification
 * @route POST /api/v1/notifications/send
 * @access Private
 */
export const createAndSendNotification = async (req, res) => {
  try {
    const senderId = req.user._id;
    const {
      receiverId,
      type,
      contentType,
      contentId,
      message,
      title,
      metadata = {},
      playerIds = null, // Optional: send to specific player IDs instead of receiverId
      sendToAll = false, // Optional: send to all users
    } = req.body;

    // Validate receiverId or playerIds or sendToAll
    if (!receiverId && !playerIds && !sendToAll) {
      return sendError(
        res,
        "Either receiverId, playerIds, or sendToAll must be provided",
        "Validation Error",
        "Missing required field",
        StatusCodes.BAD_REQUEST
      );
    }

    let notification = null;
    let pushResponse = null;

    // If receiverId is provided, create notification in database
    if (receiverId) {
      // Validate receiverId format
      if (!mongoose.Types.ObjectId.isValid(receiverId)) {
        return sendError(
          res,
          "Invalid receiverId format",
          "Validation Error",
          "receiverId must be a valid ObjectId",
          StatusCodes.BAD_REQUEST
        );
      }

      notification = await createNotification({
        receiverId,
        senderId,
        type,
        contentType,
        contentId,
        message,
        metadata,
      });
    }

    // Prepare notification payload for push
    const notificationPayload = {
      title: title || req.user.name || req.user.username || "Omeeba",
      body: message || "You have a new notification",
      imageUrl: req.user.profileImage || null,
    };

    const dataPayload = {
      notificationId: notification?._id?.toString() || null,
      type: type || null,
      contentType: contentType || null,
      contentId: contentId || null,
      ...metadata,
    };

    // Send push notification
    if (sendToAll) {
      // Send to all users
      pushResponse = await sendPushNotificationToAll(notificationPayload, dataPayload);
    } else if (playerIds && Array.isArray(playerIds) && playerIds.length > 0) {
      // Send to specific player IDs
      pushResponse = await sendPushNotificationToMultiple(
        playerIds,
        notificationPayload,
        dataPayload
      );
    } else if (receiverId) {
      // Send to specific user
      const receiver = await User.findById(receiverId).select(
        "oneSignalPlayerId pushNotificationEnabled"
      );
      if (receiver && receiver.oneSignalPlayerId) {
        pushResponse = await sendPushNotification(
          receiver.oneSignalPlayerId,
          notificationPayload,
          dataPayload
        );
      }
    }

    return sendSuccess(
      res,
      {
        notification: notification
          ? {
              id: notification._id.toString(),
              type: notification.type,
              message: notification.message,
              status: notification.status,
            }
          : null,
        pushNotification: pushResponse
          ? {
              sent: true,
              response: pushResponse,
            }
          : { sent: false },
      },
      "Notification created and sent successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create and send notification error:", error);

    return sendError(
      res,
      "Failed to create and send notification",
      "Notification Error",
      error.message || "An error occurred while creating and sending notification",
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
  createAndSendNotification,
};

