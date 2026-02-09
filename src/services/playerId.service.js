/**
 * OneSignal Player ID Service
 * Handles OneSignal player ID registration, update, and removal
 */

import User from "../models/users/User.js";
import logger from "../utils/logger.js";
import { validatePlayerId } from "./onesignal.service.js";

/**
 * Register or update OneSignal player ID for a user
 * @param {string} userId - User ID
 * @param {string} playerId - OneSignal player ID
 * @returns {Promise<Object>} Updated user
 */
export const registerPlayerId = async (userId, playerId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Validate player ID (optional - can be disabled for faster registration)
    const isValid = await validatePlayerId(playerId);
    if (!isValid) {
      logger.warn(`Invalid OneSignal player ID format: ${playerId}`);
      // Don't throw error, just log warning - let OneSignal handle validation
    }

    // Update or set the player ID
    if (user.oneSignalPlayerId !== playerId) {
      user.oneSignalPlayerId = playerId;
      logger.info(`OneSignal player ID ${user.oneSignalPlayerId ? "updated" : "registered"} for user: ${userId}`);
    } else {
      logger.info(`OneSignal player ID already set for user: ${userId}`);
    }

    await user.save();
    return user;
  } catch (error) {
    logger.error("Error registering OneSignal player ID:", error);
    throw error;
  }
};

/**
 * Remove OneSignal player ID for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user
 */
export const removePlayerId = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Remove the player ID
    user.oneSignalPlayerId = null;
    logger.info(`OneSignal player ID removed for user: ${userId}`);

    await user.save();
    return user;
  } catch (error) {
    logger.error("Error removing OneSignal player ID:", error);
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
 * Get OneSignal player ID for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Player ID and push notification settings
 */
export const getUserPlayerId = async (userId) => {
  try {
    const user = await User.findById(userId).select("oneSignalPlayerId pushNotificationEnabled");
    if (!user) {
      throw new Error("User not found");
    }

    return {
      playerId: user.oneSignalPlayerId || null,
      pushNotificationEnabled: user.pushNotificationEnabled !== false,
    };
  } catch (error) {
    logger.error("Error getting user OneSignal player ID:", error);
    throw error;
  }
};

export default {
  registerPlayerId,
  removePlayerId,
  togglePushNotification,
  getUserPlayerId,
};

