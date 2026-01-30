/**
 * Notification Service
 * Handles notification creation, aggregation, and retrieval
 */

import Notification from "../models/notifications/Notification.js";
import User from "../models/users/User.js";
import { NotificationType, NotificationStatus, ContentType } from "../models/enums.js";
import logger from "../utils/logger.js";
import { sendPushNotificationToUser } from "./firebase.service.js";

/**
 * Generate aggregation key for grouping similar notifications
 * @param {string} type - Notification type
 * @param {string} receiverId - Receiver user ID
 * @param {string} contentType - Content type (optional)
 * @param {string} contentId - Content ID (optional)
 * @returns {string} Aggregation key
 */
const generateAggregationKey = (type, receiverId, contentType = null, contentId = null) => {
  const parts = [type, receiverId.toString()];
  if (contentType) parts.push(contentType);
  if (contentId) parts.push(contentId.toString());
  return parts.join(":");
};

/**
 * Check if notification type supports aggregation
 * @param {string} type - Notification type
 * @returns {boolean} True if type supports aggregation
 */
const isAggregatableType = (type) => {
  const aggregatableTypes = [
    NotificationType.POST_LIKED,
    NotificationType.ZEAL_LIKED,
    NotificationType.WRITE_LIKED,
    NotificationType.COMMENT_LIKED,
    NotificationType.NEW_FOLLOWER,
    NotificationType.POST_COMMENT,
    NotificationType.ZEAL_COMMENT,
    NotificationType.WRITE_COMMENT,
    NotificationType.POLL_VOTED,
  ];
  return aggregatableTypes.includes(type);
};

/**
 * Generate notification message based on type and data
 * @param {string} type - Notification type
 * @param {Object} sender - Sender user object
 * @param {Object} data - Additional data (contentType, contentId, etc.)
 * @returns {string} Notification message
 */
const generateNotificationMessage = (type, sender, data = {}) => {
  const senderName = sender.name || sender.username;
  const { contentType } = data;

  const messages = {
    [NotificationType.NEW_FOLLOWER]: `${senderName} started following you`,
    [NotificationType.FOLLOW_REQUEST]: `${senderName} sent you a follow request`,
    [NotificationType.FOLLOW_REQUEST_ACCEPTED]: `${senderName} accepted your follow request`,
    
    [NotificationType.POST_LIKED]: `${senderName} liked your post`,
    [NotificationType.ZEAL_LIKED]: `${senderName} liked your zeal`,
    [NotificationType.WRITE_LIKED]: `${senderName} liked your write`,
    [NotificationType.COMMENT_LIKED]: `${senderName} liked your comment`,
    [NotificationType.AGGREGATED_LIKES]: `${senderName} and others liked your ${contentType === ContentType.POST ? "post" : contentType === ContentType.ZEAL ? "zeal" : "write"}`,
    
    [NotificationType.POST_COMMENT]: `${senderName} commented on your post`,
    [NotificationType.ZEAL_COMMENT]: `${senderName} commented on your zeal`,
    [NotificationType.WRITE_COMMENT]: `${senderName} commented on your write`,
    [NotificationType.COMMENT_REPLY]: `${senderName} replied to your comment`,
    [NotificationType.MENTION_IN_COMMENT]: `${senderName} mentioned you in a comment`,
    
    [NotificationType.MENTION_IN_POST]: `${senderName} mentioned you in a post`,
    [NotificationType.MENTION_IN_ZEAL]: `${senderName} mentioned you in a zeal`,
    [NotificationType.MENTION_IN_WRITE]: `${senderName} mentioned you in a write`,
    
    [NotificationType.CONTENT_SHARED]: `${senderName} shared your ${contentType === ContentType.POST ? "post" : contentType === ContentType.ZEAL ? "zeal" : "write"}`,
    [NotificationType.CONTENT_SHARED_WITH_YOU]: `${senderName} shared a ${contentType === ContentType.POST ? "post" : contentType === ContentType.ZEAL ? "zeal" : "write"} with you`,
    
    [NotificationType.NEW_SNAP_RECEIVED]: `${senderName} sent you a snap`,
    [NotificationType.SNAP_VIEWED]: `${senderName} viewed your snap`,
    
    [NotificationType.POLL_VOTED]: `${senderName} voted on your poll`,
    [NotificationType.POLL_ENDED]: `Your poll has ended`,
    
    [NotificationType.VERIFIED_BADGE_ACTIVATED]: `Your verified badge has been activated`,
    [NotificationType.VERIFIED_BADGE_EXPIRED]: `Your verified badge has expired`,
    [NotificationType.SUBSCRIPTION_PAYMENT_SUCCESS]: `Your subscription payment was successful`,
    
    [NotificationType.CONTENT_REPORTED]: `Your content has been reported`,
    [NotificationType.MODERATION_ACTION]: `Moderation action has been taken on your content`,
  };

  return messages[type] || `${senderName} interacted with your content`;
};

/**
 * Generate aggregated notification message
 * @param {string} type - Original notification type
 * @param {Object} firstSender - First sender user object
 * @param {Object} latestSender - Latest sender user object (optional)
 * @param {number} count - Total aggregated count
 * @param {string} contentType - Content type (optional)
 * @returns {string} Aggregated notification message
 */
const generateAggregatedMessage = (type, firstSender, latestSender = null, count, contentType = null) => {
  const firstSenderName = firstSender.name || firstSender.username;
  const latestSenderName = latestSender ? (latestSender.name || latestSender.username) : firstSenderName;

  // Get content type label
  const getContentLabel = () => {
    if (contentType === ContentType.POST) return "post";
    if (contentType === ContentType.ZEAL) return "zeal";
    if (contentType === ContentType.WRITE_POST) return "write";
    return "content";
  };

  const contentLabel = getContentLabel();

  // Generate message based on notification type
  if (type === NotificationType.POST_LIKED || 
      type === NotificationType.ZEAL_LIKED || 
      type === NotificationType.WRITE_LIKED) {
    if (count === 1) {
      return `${latestSenderName} liked your ${contentLabel}`;
    } else {
      const othersCount = count - 1;
      return `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} liked your ${contentLabel}`;
    }
  }

  if (type === NotificationType.COMMENT_LIKED) {
    if (count === 1) {
      return `${latestSenderName} liked your comment`;
    } else {
      const othersCount = count - 1;
      return `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} liked your comment`;
    }
  }

  if (type === NotificationType.NEW_FOLLOWER) {
    if (count === 1) {
      return `${latestSenderName} started following you`;
    } else {
      const othersCount = count - 1;
      return `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} started following you`;
    }
  }

  if (type === NotificationType.POST_COMMENT || 
      type === NotificationType.ZEAL_COMMENT || 
      type === NotificationType.WRITE_COMMENT) {
    if (count === 1) {
      return `${latestSenderName} commented on your ${contentLabel}`;
    } else {
      const othersCount = count - 1;
      return `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} commented on your ${contentLabel}`;
    }
  }

  if (type === NotificationType.POLL_VOTED) {
    if (count === 1) {
      return `${latestSenderName} voted on your poll`;
    } else {
      const othersCount = count - 1;
      return `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} voted on your poll`;
    }
  }

  // Default fallback
  if (count === 1) {
    return `${latestSenderName} interacted with your ${contentLabel}`;
  } else {
    const othersCount = count - 1;
    return `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} interacted with your ${contentLabel}`;
  }
};

/**
 * Create or update aggregated notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Created or updated notification
 */
const createOrUpdateAggregatedNotification = async (notificationData) => {
  const {
    receiverId,
    senderId,
    type,
    contentType,
    contentId,
    message,
    metadata = {},
  } = notificationData;

  const aggregationKey = generateAggregationKey(type, receiverId, contentType, contentId);

  // Get receiver user for push notifications
  const receiver = await User.findById(receiverId).select("fcmToken pushNotificationEnabled");
  if (!receiver || receiver.isDeleted) {
    logger.warn(`Receiver not found or deleted for notification: ${receiverId}`);
    return null;
  }

  // Find existing aggregated notification (within last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existingNotification = await Notification.findOne({
    aggregationKey,
    receiverId,
    isAggregated: true,
    createdAt: { $gte: oneDayAgo },
  }).populate("aggregatedUserIds", "name username profileImage");

  if (existingNotification) {
    // Check if sender already in aggregated list
    const senderExists = existingNotification.aggregatedUserIds.some(
      (userId) => userId._id.toString() === senderId.toString()
    );

    if (!senderExists) {
      // Get latest sender details
      const latestSender = await User.findById(senderId).select("name username profileImage");
      
      if (latestSender) {
        // Add new sender to aggregation
        existingNotification.aggregatedUserIds.push(senderId);
        existingNotification.aggregatedCount += 1;

        // Get first sender (already populated from query)
        const firstSender = existingNotification.aggregatedUserIds[0];
        
        if (firstSender) {
          const totalCount = existingNotification.aggregatedCount;
          existingNotification.message = generateAggregatedMessage(
            existingNotification.type,
            firstSender,
            latestSender,
            totalCount,
            existingNotification.contentType
          );
        }

        existingNotification.status = NotificationStatus.UNREAD;
        existingNotification.updatedAt = new Date();
        await existingNotification.save();

        // Send push notification for aggregated update (non-blocking)
        sendPushNotificationAsync(
          receiver,
          latestSender,
          existingNotification.message,
          {
            notificationId: existingNotification._id.toString(),
            type: existingNotification.type,
            contentType: existingNotification.contentType || null,
            contentId: existingNotification.contentId
              ? existingNotification.contentId.toString()
              : null,
            isAggregated: true,
            aggregatedCount: existingNotification.aggregatedCount,
            ...existingNotification.metadata,
          }
        ).catch((error) => {
          logger.error("Failed to send push notification for aggregated update:", error);
        });
      }
    }

    return existingNotification;
  } else {
    // Create new aggregated notification
    // Preserve the original notification type instead of always using AGGREGATED_LIKES
    const notification = await Notification.create({
      receiverId,
      senderId,
      type: type, // Preserve original type (POST_LIKED, NEW_FOLLOWER, etc.)
      contentType,
      contentId,
      message,
      aggregationKey,
      isAggregated: true,
      aggregatedCount: 1,
      aggregatedUserIds: [senderId],
      metadata,
      status: NotificationStatus.UNREAD,
    });

    // Send push notification for new aggregated notification (non-blocking)
    const sender = await User.findById(senderId).select("name username profileImage");
    if (sender) {
      sendPushNotificationAsync(receiver, sender, message, {
        notificationId: notification._id.toString(),
        type: notification.type,
        contentType: contentType || null,
        contentId: contentId ? contentId.toString() : null,
        isAggregated: true,
        aggregatedCount: 1,
        ...metadata,
      }).catch((error) => {
        logger.error("Failed to send push notification for new aggregated notification:", error);
      });
    }

    return notification;
  }
};

/**
 * Create a notification
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.receiverId - User ID who receives notification
 * @param {string} notificationData.senderId - User ID who triggered action
 * @param {string} notificationData.type - Notification type
 * @param {string} notificationData.contentType - Content type (optional)
 * @param {string} notificationData.contentId - Content ID (optional)
 * @param {string} notificationData.message - Custom message (optional, auto-generated if not provided)
 * @param {Object} notificationData.metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Created notification
 */
export const createNotification = async (notificationData) => {
  try {
    const {
      receiverId,
      senderId,
      type,
      contentType = null,
      contentId = null,
      message = null,
      metadata = {},
    } = notificationData;

    // Don't create notification if user is notifying themselves
    if (receiverId.toString() === senderId.toString()) {
      return null;
    }

    // Get sender user
    const sender = await User.findById(senderId).select("name username profileImage");
    if (!sender) {
      logger.warn(`Sender not found for notification: ${senderId}`);
      return null;
    }

    // Get receiver user (with FCM token for push notifications)
    const receiver = await User.findById(receiverId).select("_id fcmToken pushNotificationEnabled");
    if (!receiver || receiver.isDeleted) {
      logger.warn(`Receiver not found or deleted for notification: ${receiverId}`);
      return null;
    }

    // Generate message if not provided
    const notificationMessage =
      message ||
      generateNotificationMessage(type, sender, { contentType });

    let notification;

    // Check if this type supports aggregation
    if (isAggregatableType(type)) {
      // Use aggregation for likes, follows, comments
      notification = await createOrUpdateAggregatedNotification({
        receiverId,
        senderId,
        type,
        contentType,
        contentId,
        message: notificationMessage,
        metadata,
      });
    } else {
      // Create individual notification
      notification = await Notification.create({
        receiverId,
        senderId,
        type,
        contentType,
        contentId,
        message: notificationMessage,
        metadata,
        status: NotificationStatus.UNREAD,
      });

      logger.info(`Notification created: ${type} from ${senderId} to ${receiverId}`);
    }

    // Send push notification (non-blocking)
    if (notification) {
      sendPushNotificationAsync(receiver, sender, notificationMessage, {
        notificationId: notification._id.toString(),
        type: type,
        contentType: contentType || null,
        contentId: contentId ? contentId.toString() : null,
        ...metadata,
      }).catch((error) => {
        // Log error but don't fail notification creation
        logger.error("Failed to send push notification:", error);
      });
    }

    return notification;
  } catch (error) {
    logger.error("Error creating notification:", error);
    // Don't throw - notifications are non-critical
    return null;
  }
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (to verify ownership)
 * @returns {Promise<Object>} Updated notification
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOne({
      _id: notificationId,
      receiverId: userId,
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.status === NotificationStatus.READ) {
      return notification;
    }

    notification.status = NotificationStatus.READ;
    await notification.save();

    return notification;
  } catch (error) {
    logger.error("Error marking notification as read:", error);
    throw error;
  }
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Update result
 */
export const markAllNotificationsAsRead = async (userId) => {
  try {
    const result = await Notification.updateMany(
      {
        receiverId: userId,
        status: NotificationStatus.UNREAD,
      },
      {
        $set: {
          status: NotificationStatus.READ,
          updatedAt: new Date(),
        },
      }
    );

    return result;
  } catch (error) {
    logger.error("Error marking all notifications as read:", error);
    throw error;
  }
};

/**
 * Get notifications for a user with pagination
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @param {string} options.status - Filter by status: 'all', 'unread', 'read' (default: 'all')
 * @param {string} options.type - Filter by notification type (optional)
 * @returns {Promise<Object>} Notifications with pagination
 */
export const getNotifications = async (userId, options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = "all",
      type = null,
    } = options;

    const skip = (page - 1) * limit;

    // Build query
    const query = { receiverId: userId };

    if (status === "unread") {
      query.status = NotificationStatus.UNREAD;
    } else if (status === "read") {
      query.status = NotificationStatus.READ;
    }

    if (type) {
      query.type = type;
    }

    // Get notifications
    const notifications = await Notification.find(query)
      .populate("senderId", "name username profileImage isAccountVerified isVerifiedBadge")
      .populate("aggregatedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get total count
    const total = await Notification.countDocuments(query);

    // Format notifications
    const formattedNotifications = notifications.map((notification) => {
      const formatted = {
        id: notification._id.toString(),
        type: notification.type,
        message: notification.message,
        status: notification.status,
        contentType: notification.contentType,
        contentId: notification.contentId
          ? notification.contentId.toString()
          : null,
        sender: notification.senderId
          ? {
              id: notification.senderId._id.toString(),
              name: notification.senderId.name,
              username: notification.senderId.username,
              profileImage: notification.senderId.profileImage,
              isAccountVerified: notification.senderId.isAccountVerified,
              isVerifiedBadge: notification.senderId.isVerifiedBadge,
            }
          : null,
        isAggregated: notification.isAggregated || false,
        aggregatedCount: notification.aggregatedCount || 0,
        aggregatedUsers: (notification.aggregatedUserIds || []).map((user) => ({
          id: user._id.toString(),
          name: user.name,
          username: user.username,
          profileImage: user.profileImage,
          isAccountVerified: user.isAccountVerified,
          isVerifiedBadge: user.isVerifiedBadge,
        })),
        metadata: notification.metadata || {},
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      };

      return formatted;
    });

    return {
      notifications: formattedNotifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error("Error getting notifications:", error);
    throw error;
  }
};

/**
 * Get unread notification count for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      receiverId: userId,
      status: NotificationStatus.UNREAD,
    });

    return count;
  } catch (error) {
    logger.error("Error getting unread notification count:", error);
    throw error;
  }
};

/**
 * Delete a notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (to verify ownership)
 * @returns {Promise<Object>} Deleted notification
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      receiverId: userId,
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    return notification;
  } catch (error) {
    logger.error("Error deleting notification:", error);
    throw error;
  }
};

/**
 * Send push notification asynchronously (non-blocking)
 * @param {Object} receiver - Receiver user object
 * @param {Object} sender - Sender user object
 * @param {string} message - Notification message
 * @param {Object} data - Additional data payload
 */
const sendPushNotificationAsync = async (receiver, sender, message, data = {}) => {
  try {
    // Prepare notification payload
    const notificationPayload = {
      title: sender.name || sender.username || "Omeeba",
      body: message,
      imageUrl: sender.profileImage || null,
    };

    // Send push notification
    await sendPushNotificationToUser(receiver, notificationPayload, data);
  } catch (error) {
    // If token is invalid, we might want to remove it
    if (error.message === "INVALID_TOKEN") {
      logger.warn(`Invalid FCM token detected for user: ${receiver._id}`);
      // Optionally remove invalid tokens here
    }
    throw error;
  }
};

export default {
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getNotifications,
  getUnreadNotificationCount,
  deleteNotification,
};

