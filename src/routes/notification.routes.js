import express from "express";
import { protect } from "../middleware/auth.js";
import { validateQuery, validateParams, validateBody } from "../utils/validation.js";
import {
  getNotificationsList,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotificationById,
  createAndSendNotification,
} from "../controllers/notification.controller.js";
import {
  registerToken,
  removeToken,
  togglePushSettings,
  getTokens,
} from "../controllers/fcmToken.controller.js";
import {
  getNotificationsSchema,
  notificationIdSchema,
  createAndSendNotificationSchema,
} from "../validators/notification.validator.js";
import {
  registerPlayerIdSchema,
  togglePushNotificationSchema,
} from "../validators/fcmToken.validator.js";

const router = express.Router();

/**
 * @route   GET /api/v1/notifications
 * @desc    Get notifications for authenticated user
 * @access  Private
 * @query   status - Filter by status: 'all', 'unread', 'read' (default: 'all')
 * @query   type - Filter by notification type (optional)
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get(
  "/",
  protect,
  validateQuery(getNotificationsSchema),
  getNotificationsList
);

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get unread notification count
 * @access  Private
 */
router.get("/unread-count", protect, getUnreadCount);

/**
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @desc    Mark a notification as read
 * @access  Private
 * @param   notificationId - Notification ID
 */
router.put(
  "/:notificationId/read",
  protect,
  validateParams(notificationIdSchema),
  markAsRead
);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put("/read-all", protect, markAllAsRead);

/**
 * @route   POST /api/v1/notifications/player-id
 * @desc    Register or update OneSignal player ID for push notifications
 * @access  Private
 * @body    playerId - OneSignal player ID (required)
 */
router.post(
  "/player-id",
  protect,
  validateBody(registerPlayerIdSchema),
  registerToken
);

/**
 * @route   GET /api/v1/notifications/player-id
 * @desc    Get user's OneSignal player ID
 * @access  Private
 */
router.get("/player-id", protect, getTokens);

/**
 * @route   DELETE /api/v1/notifications/player-id
 * @desc    Remove OneSignal player ID
 * @access  Private
 */
router.delete(
  "/player-id",
  protect,
  removeToken
);

/**
 * @route   DELETE /api/v1/notifications/:notificationId
 * @desc    Delete a notification
 * @access  Private
 * @param   notificationId - Notification ID
 */
router.delete(
  "/:notificationId",
  protect,
  validateParams(notificationIdSchema),
  deleteNotificationById
);

/**
 * @route   PUT /api/v1/notifications/push-settings
 * @desc    Toggle push notification setting
 * @access  Private
 * @body    enabled - Boolean to enable/disable push notifications
 */
router.put(
  "/push-settings",
  protect,
  validateBody(togglePushNotificationSchema),
  togglePushSettings
);

/**
 * @route   POST /api/v1/notifications/send
 * @desc    Create and send notification with push notification
 * @access  Private
 * @body    receiverId - User ID to receive notification (optional if playerIds or sendToAll provided)
 * @body    playerIds - Array of OneSignal player IDs (optional)
 * @body    sendToAll - Boolean to send to all users (optional)
 * @body    type - Notification type (optional)
 * @body    contentType - Content type (optional)
 * @body    contentId - Content ID (optional)
 * @body    message - Notification message (optional)
 * @body    title - Push notification title (optional)
 * @body    metadata - Additional metadata (optional)
 */
router.post(
  "/send",
  protect,
  validateBody(createAndSendNotificationSchema),
  createAndSendNotification
);

export default router;

