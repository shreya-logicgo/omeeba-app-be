import express from "express";
import { protect } from "../middleware/auth.js";
import { validateQuery, validateParams, validateBody } from "../utils/validation.js";
import {
  getNotificationsList,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotificationById,
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
} from "../validators/notification.validator.js";
import {
  registerFCMTokenSchema,
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
 * @route   POST /api/v1/notifications/fcm-token
 * @desc    Register or update FCM token for push notifications
 * @access  Private
 * @body    fcmToken - FCM token (required)
 */
router.post(
  "/fcm-token",
  protect,
  validateBody(registerFCMTokenSchema),
  registerToken
);

/**
 * @route   GET /api/v1/notifications/fcm-token
 * @desc    Get user's FCM tokens
 * @access  Private
 */
router.get("/fcm-token", protect, getTokens);

/**
 * @route   DELETE /api/v1/notifications/fcm-token
 * @desc    Remove FCM token
 * @access  Private
 */
router.delete(
  "/fcm-token",
  protect,
  removeToken
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

export default router;

