/**
 * Firebase Cloud Messaging (FCM) Service
 * Handles push notifications via Firebase
 */

import admin from "firebase-admin";
import config from "../config/env.js";
import logger from "../utils/logger.js";

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 */
export const initializeFirebase = () => {
  try {
    if (firebaseApp) {
      logger.info("Firebase already initialized");
      return firebaseApp;
    }

    // Check if Firebase credentials are provided
    if (!config.firebase.serviceAccountKey && !config.firebase.projectId) {
      logger.warn("Firebase credentials not configured. Push notifications will be disabled.");
      return null;
    }

    let credential;

    // Option 1: Use full service account JSON string
    if (config.firebase.serviceAccountKey) {
      try {
        const serviceAccount = JSON.parse(config.firebase.serviceAccountKey);
        credential = admin.credential.cert(serviceAccount);
      } catch (error) {
        logger.error("Failed to parse Firebase service account key:", error);
        return null;
      }
    }
    // Option 2: Use individual credentials
    else if (config.firebase.projectId && config.firebase.privateKey && config.firebase.clientEmail) {
      credential = admin.credential.cert({
        projectId: config.firebase.projectId,
        privateKey: config.firebase.privateKey,
        clientEmail: config.firebase.clientEmail,
      });
    } else {
      logger.warn("Firebase credentials incomplete. Push notifications will be disabled.");
      return null;
    }

    firebaseApp = admin.initializeApp({
      credential: credential,
    });

    logger.info("Firebase Admin SDK initialized successfully");
    return firebaseApp;
  } catch (error) {
    logger.error("Failed to initialize Firebase:", error);
    return null;
  }
};

/**
 * Send push notification to a single device
 * @param {string} fcmToken - FCM token of the device
 * @param {Object} notification - Notification payload
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} notification.imageUrl - Optional image URL
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<Object>} FCM response
 */
export const sendPushNotification = async (fcmToken, notification, data = {}) => {
  try {
    if (!firebaseApp) {
      logger.warn("Firebase not initialized. Cannot send push notification.");
      return null;
    }

    if (!fcmToken) {
      logger.warn("FCM token is required to send push notification");
      return null;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      data: {
        ...data,
        // Convert all data values to strings (FCM requirement)
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}),
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          icon: notification.imageUrl || undefined,
        },
      },
    };

    const response = await admin.messaging().send(message);
    logger.info(`Push notification sent successfully: ${response}`);
    return response;
  } catch (error) {
    logger.error("Error sending push notification:", error);

    // Handle invalid token errors
    if (error.code === "messaging/invalid-registration-token" || 
        error.code === "messaging/registration-token-not-registered") {
      logger.warn(`Invalid FCM token: ${fcmToken}`);
      throw new Error("INVALID_TOKEN");
    }

    throw error;
  }
};

/**
 * Send push notification to multiple devices
 * @param {string[]} fcmTokens - Array of FCM tokens
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<Object>} Batch response with success and failure counts
 */
export const sendPushNotificationToMultiple = async (fcmTokens, notification, data = {}) => {
  try {
    if (!firebaseApp) {
      logger.warn("Firebase not initialized. Cannot send push notifications.");
      return { successCount: 0, failureCount: fcmTokens.length, responses: [] };
    }

    if (!fcmTokens || fcmTokens.length === 0) {
      logger.warn("FCM tokens array is empty");
      return { successCount: 0, failureCount: 0, responses: [] };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      data: {
        ...data,
        // Convert all data values to strings (FCM requirement)
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}),
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      webpush: {
        notification: {
          icon: notification.imageUrl || undefined,
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast({
      tokens: fcmTokens,
      ...message,
    });

    logger.info(
      `Push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    };
  } catch (error) {
    logger.error("Error sending push notifications to multiple devices:", error);
    throw error;
  }
};

/**
 * Send push notification to a user
 * @param {Object} user - User object with fcmToken
 * @param {Object} notification - Notification payload
 * @param {Object} data - Additional data payload (optional)
 * @returns {Promise<Object>} FCM response
 */
export const sendPushNotificationToUser = async (user, notification, data = {}) => {
  try {
    // Check if user has push notifications enabled
    if (user.pushNotificationEnabled === false) {
      logger.info(`Push notifications disabled for user: ${user._id}`);
      return null;
    }

    // Get FCM token for the user
    const fcmToken = user.fcmToken;

    if (!fcmToken || typeof fcmToken !== "string") {
      logger.info(`No FCM token found for user: ${user._id}`);
      return null;
    }

    return await sendPushNotification(fcmToken, notification, data);
  } catch (error) {
    logger.error(`Error sending push notification to user ${user._id}:`, error);
    throw error;
  }
};

/**
 * Validate FCM token
 * @param {string} fcmToken - FCM token to validate
 * @returns {Promise<boolean>} True if token is valid
 */
export const validateFCMToken = async (fcmToken) => {
  try {
    if (!firebaseApp) {
      return false;
    }

    // Try to send a test message (dry run)
    await admin.messaging().send(
      {
        token: fcmToken,
        notification: {
          title: "Test",
          body: "Test",
        },
      },
      true // dry run
    );

    return true;
  } catch (error) {
    if (error.code === "messaging/invalid-registration-token" || 
        error.code === "messaging/registration-token-not-registered") {
      return false;
    }
    logger.error("Error validating FCM token:", error);
    return false;
  }
};

// Initialize Firebase on module load
initializeFirebase();

export default {
  initializeFirebase,
  sendPushNotification,
  sendPushNotificationToMultiple,
  sendPushNotificationToUser,
  validateFCMToken,
};

