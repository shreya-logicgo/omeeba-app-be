/**
 * OneSignal Push Notification Service
 * Handles push notifications via OneSignal
 */

import { Client } from "onesignal-node";
import config from "../config/env.js";
import logger from "../utils/logger.js";

let oneSignalClient = null;

/**
 * Initialize OneSignal Client
 */
export const initializeOneSignal = () => {
  try {
    if (oneSignalClient) {
      logger.info("OneSignal already initialized");
      return oneSignalClient;
    }

    // Check if OneSignal credentials are provided
    if (!config.onesignal.appId || !config.onesignal.apiKey) {
      logger.warn("OneSignal credentials not configured. Push notifications will be disabled.");
      return null;
    }

    oneSignalClient = new Client(config.onesignal.appId, config.onesignal.apiKey);

    logger.info("OneSignal Client initialized successfully");
    return oneSignalClient;
  } catch (error) {
    logger.error("Failed to initialize OneSignal:", error);
    return null;
  }
};

/**
 * Send push notification to a single device
 * @param {string} playerId - OneSignal player ID of the device
 * @param {Object} notification - Notification payload
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.imageUrl - Optional image URL
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<Object>} OneSignal response
 */
export const sendPushNotification = async (playerId, notification, data = {}) => {
  try {
    if (!oneSignalClient) {
      logger.warn("OneSignal not initialized. Cannot send push notification.");
      return null;
    }

    if (!playerId) {
      logger.warn("OneSignal player ID is required to send push notification");
      return null;
    }

    const notificationPayload = {
      contents: {
        en: notification.body,
      },
      headings: {
        en: notification.title,
      },
      include_player_ids: [playerId],
      data: data,
    };

    // Add image if provided
    if (notification.imageUrl) {
      notificationPayload.big_picture = notification.imageUrl;
      notificationPayload.large_icon = notification.imageUrl;
    }

    const response = await oneSignalClient.createNotification(notificationPayload);
    logger.info(`Push notification sent successfully: ${response.id}`);
    return response;
  } catch (error) {
    logger.error("Error sending push notification:", error);

    // Handle invalid player ID errors
    if (error.statusCode === 400 && error.body?.errors) {
      const errors = error.body.errors;
      if (errors.some((err) => err.includes("Invalid player id") || err.includes("Player not found"))) {
        logger.warn(`Invalid OneSignal player ID: ${playerId}`);
        throw new Error("INVALID_TOKEN");
      }
    }

    throw error;
  }
};

/**
 * Send push notification to multiple devices
 * @param {string[]} playerIds - Array of OneSignal player IDs
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<Object>} Batch response with success and failure counts
 */
export const sendPushNotificationToMultiple = async (playerIds, notification, data = {}) => {
  try {
    if (!oneSignalClient) {
      logger.warn("OneSignal not initialized. Cannot send push notifications.");
      return { successCount: 0, failureCount: playerIds.length, responses: [] };
    }

    if (!playerIds || playerIds.length === 0) {
      logger.warn("OneSignal player IDs array is empty");
      return { successCount: 0, failureCount: 0, responses: [] };
    }

    const notificationPayload = {
      contents: {
        en: notification.body,
      },
      headings: {
        en: notification.title,
      },
      include_player_ids: playerIds,
      data: data,
    };

    // Add image if provided
    if (notification.imageUrl) {
      notificationPayload.big_picture = notification.imageUrl;
      notificationPayload.large_icon = notification.imageUrl;
    }

    const response = await oneSignalClient.createNotification(notificationPayload);

    // OneSignal returns recipients count
    const successCount = response.recipients || 0;
    const failureCount = playerIds.length - successCount;

    logger.info(
      `Push notifications sent: ${successCount} successful, ${failureCount} failed`
    );

    return {
      successCount,
      failureCount,
      responses: [response],
    };
  } catch (error) {
    logger.error("Error sending push notifications to multiple devices:", error);
    throw error;
  }
};

/**
 * Send push notification to a user
 * @param {Object} user - User object with oneSignalPlayerId
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<Object>} OneSignal response
 */
export const sendPushNotificationToUser = async (user, notification, data = {}) => {
  try {
    // Check if user has push notifications enabled
    if (user.pushNotificationEnabled === false) {
      logger.info(`Push notifications disabled for user: ${user._id}`);
      return null;
    }

    // Get OneSignal player ID for the user
    const playerId = user.oneSignalPlayerId;

    if (!playerId || typeof playerId !== "string") {
      logger.info(`No OneSignal player ID found for user: ${user._id}`);
      return null;
    }

    return await sendPushNotification(playerId, notification, data);
  } catch (error) {
    logger.error(`Error sending push notification to user ${user._id}:`, error);
    throw error;
  }
};

/**
 * Send push notification to all users (broadcast)
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<Object>} OneSignal response
 */
export const sendPushNotificationToAll = async (notification, data = {}) => {
  try {
    if (!oneSignalClient) {
      logger.warn("OneSignal not initialized. Cannot send push notifications.");
      return null;
    }

    const notificationPayload = {
      contents: {
        en: notification.body,
      },
      headings: {
        en: notification.title,
      },
      included_segments: ["All"],
      data: data,
    };

    // Add image if provided
    if (notification.imageUrl) {
      notificationPayload.big_picture = notification.imageUrl;
      notificationPayload.large_icon = notification.imageUrl;
    }

    const response = await oneSignalClient.createNotification(notificationPayload);
    logger.info(`Broadcast push notification sent successfully: ${response.id}`);
    return response;
  } catch (error) {
    logger.error("Error sending broadcast push notification:", error);
    throw error;
  }
};

/**
 * Validate OneSignal player ID
 * @param {string} playerId - OneSignal player ID to validate
 * @returns {Promise<boolean>} True if player ID is valid
 */
export const validatePlayerId = async (playerId) => {
  try {
    if (!oneSignalClient || !playerId) {
      return false;
    }

    // OneSignal doesn't have a direct validation endpoint
    // We can try to send a silent notification to validate
    // For now, we'll just check if it's a valid format (UUID-like)
    const playerIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return playerIdRegex.test(playerId);
  } catch (error) {
    logger.error("Error validating OneSignal player ID:", error);
    return false;
  }
};

// Initialize OneSignal on module load
initializeOneSignal();

export default {
  initializeOneSignal,
  sendPushNotification,
  sendPushNotificationToMultiple,
  sendPushNotificationToUser,
  sendPushNotificationToAll,
  validatePlayerId,
};

