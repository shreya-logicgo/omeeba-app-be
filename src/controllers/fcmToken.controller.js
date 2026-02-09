/**
 * Player ID Controller
 * Handles HTTP requests for OneSignal player ID management
 */

import {
  registerPlayerId,
  removePlayerId,
  togglePushNotification,
  getUserPlayerId,
} from "../services/playerId.service.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Register or Update OneSignal Player ID
 * @route POST /api/v1/notifications/player-id
 * @access Private
 */
export const registerToken = async (req, res) => {
  try {
    const userId = req.user._id;
    const { playerId } = req.body;

    if (!playerId) {
      return sendError(
        res,
        "Player ID is required",
        "Validation Error",
        "playerId is required",
        StatusCodes.BAD_REQUEST
      );
    }

    const user = await registerPlayerId(userId, playerId);

    return sendSuccess(
      res,
      {
        message: "OneSignal player ID registered successfully",
        hasPlayerId: !!user.oneSignalPlayerId,
      },
      "OneSignal player ID registered successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Register OneSignal player ID error:", error);

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
      "Failed to register OneSignal player ID",
      "Player ID Error",
      error.message || "An error occurred while registering OneSignal player ID",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Remove OneSignal Player ID
 * @route DELETE /api/v1/notifications/player-id
 * @access Private
 */
export const removeToken = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await removePlayerId(userId);

    return sendSuccess(
      res,
      {
        message: "OneSignal player ID removed successfully",
        hasPlayerId: !!user.oneSignalPlayerId,
      },
      "OneSignal player ID removed successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Remove OneSignal player ID error:", error);

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
      "Failed to remove OneSignal player ID",
      "Player ID Error",
      error.message || "An error occurred while removing OneSignal player ID",
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
      "Player ID Error",
      error.message || "An error occurred while toggling push notification setting",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get User OneSignal Player ID
 * @route GET /api/v1/notifications/player-id
 * @access Private
 */
export const getTokens = async (req, res) => {
  try {
    const userId = req.user._id;

    const result = await getUserPlayerId(userId);

    return sendSuccess(
      res,
      {
        playerId: result.playerId,
        pushNotificationEnabled: result.pushNotificationEnabled,
      },
      "OneSignal player ID retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get OneSignal player ID error:", error);

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
      "Failed to retrieve OneSignal player ID",
      "Player ID Error",
      error.message || "An error occurred while retrieving OneSignal player ID",
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

