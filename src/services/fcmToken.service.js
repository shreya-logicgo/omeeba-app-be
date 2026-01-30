/**
 * FCM Token Service
 * Handles FCM token registration, update, and removal
 */

import User from "../models/users/User.js";
import logger from "../utils/logger.js";
// import { validateFCMToken } from "./firebase.service.js"; // Optional: Enable for token validation

/**
 * Register or update FCM token for a user
 * @param {string} userId - User ID
 * @param {string} fcmToken - FCM token
 * @returns {Promise<Object>} Updated user
 */
export const registerFCMToken = async (userId, fcmToken) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Validate FCM token (optional - can be disabled for faster registration)
    // const isValid = await validateFCMToken(fcmToken);
    // if (!isValid) {
    //   throw new Error("Invalid FCM token");
    // }

    // Update or set the token
    if (user.fcmToken !== fcmToken) {
      user.fcmToken = fcmToken;
      logger.info(`FCM token ${user.fcmToken ? "updated" : "registered"} for user: ${userId}`);
    } else {
      logger.info(`FCM token already set for user: ${userId}`);
    }

    await user.save();
    return user;
  } catch (error) {
    logger.error("Error registering FCM token:", error);
    throw error;
  }
};

/**
 * Remove FCM token for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user
 */
export const removeFCMToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Remove the token
    user.fcmToken = null;
    logger.info(`FCM token removed for user: ${userId}`);

    await user.save();
    return user;
  } catch (error) {
    logger.error("Error removing FCM token:", error);
    throw error;
  }
};

/**
 * Toggle push notification setting for a user
 * @param {string} userId - User ID
 * @param {boolean} enabled - Enable or disable push notifications
 * @returns {Promise<Object>} Updated user
 */
export const togglePushNotification = async (userId, enabled) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.pushNotificationEnabled = enabled;
    await user.save();

    logger.info(`Push notifications ${enabled ? "enabled" : "disabled"} for user: ${userId}`);
    return user;
  } catch (error) {
    logger.error("Error toggling push notification:", error);
    throw error;
  }
};

/**
 * Get FCM token for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} FCM token and push notification settings
 */
export const getUserFCMTokens = async (userId) => {
  try {
    const user = await User.findById(userId).select("fcmToken pushNotificationEnabled");
    if (!user) {
      throw new Error("User not found");
    }

    return {
      fcmToken: user.fcmToken || null,
      pushNotificationEnabled: user.pushNotificationEnabled !== false,
    };
  } catch (error) {
    logger.error("Error getting user FCM token:", error);
    throw error;
  }
};

export default {
  registerFCMToken,
  removeFCMToken,
  togglePushNotification,
  getUserFCMTokens,
};

