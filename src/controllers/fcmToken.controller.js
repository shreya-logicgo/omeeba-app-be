/**
 * FCM Token Controller
 * Handles HTTP requests for FCM token management
 */

import {
  registerFCMToken,
  removeFCMToken,
  togglePushNotification,
  getUserFCMTokens,
} from "../services/fcmToken.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Register or Update FCM Token
 * @route POST /api/v1/notifications/fcm-token
 * @access Private
 */
export const registerToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fcmToken } = req.body;

    const user = await registerFCMToken(userId, fcmToken);

    return sendSuccess(
      res,
      {
        message: "FCM token registered successfully",
        hasToken: !!user.fcmToken,
      },
      "FCM token registered successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Register FCM token error:", error);

    if (error.message === "User not found") {
      return sendError(
        res,
        "User not found",
        "Not Found",
        error.message,
        StatusCodes.NOT_FOUND
      );
    }

    if (error.message === "Invalid FCM token") {
      return sendError(
        res,
        "Invalid FCM token",
        "Validation Error",
        error.message,
        StatusCodes.BAD_REQUEST
      );
    }

    return sendError(
      res,
      "Failed to register FCM token",
      "FCM Token Error",
      error.message || "An error occurred while registering FCM token",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Remove FCM Token
 * @route DELETE /api/v1/notifications/fcm-token
 * @access Private
 */
export const removeToken = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await removeFCMToken(userId);

    return sendSuccess(
      res,
      {
        message: "FCM token removed successfully",
        hasToken: !!user.fcmToken,
      },
      "FCM token removed successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Remove FCM token error:", error);

    if (error.message === "User not found") {
      return sendError(
        res,
        "User not found",
        "Not Found",
        error.message,
        StatusCodes.NOT_FOUND
      );
    }

    return sendError(
      res,
      "Failed to remove FCM token",
      "FCM Token Error",
      error.message || "An error occurred while removing FCM token",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Toggle Push Notification Setting
 * @route PUT /api/v1/notifications/push-settings
 * @access Private
 */
export const togglePushSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { enabled } = req.body;

    await togglePushNotification(userId, enabled);

    return sendSuccess(
      res,
      {
        pushNotificationEnabled: enabled,
      },
      `Push notifications ${enabled ? "enabled" : "disabled"} successfully`,
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Toggle push notification error:", error);

    if (error.message === "User not found") {
      return sendError(
        res,
        "User not found",
        "Not Found",
        error.message,
        StatusCodes.NOT_FOUND
      );
    }

    return sendError(
      res,
      "Failed to toggle push notification setting",
      "FCM Token Error",
      error.message || "An error occurred while toggling push notification setting",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get User FCM Tokens
 * @route GET /api/v1/notifications/fcm-token
 * @access Private
 */
export const getTokens = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await getUserFCMTokens(userId);

    return sendSuccess(
      res,
      result,
      "FCM tokens retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get FCM tokens error:", error);

    if (error.message === "User not found") {
      return sendError(
        res,
        "User not found",
        "Not Found",
        error.message,
        StatusCodes.NOT_FOUND
      );
    }

    return sendError(
      res,
      "Failed to retrieve FCM tokens",
      "FCM Token Error",
      error.message || "An error occurred while retrieving FCM tokens",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  registerToken,
  removeToken,
  togglePushSettings,
  getTokens,
};

