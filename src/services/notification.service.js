/**
 * Notification Service
 * Handles notification creation, aggregation, and retrieval
 */

import Notification from "../models/notifications/Notification.js";
import User from "../models/users/User.js";
import { NotificationType, NotificationStatus, ContentType } from "../models/enums.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { sendPushNotificationToUser } from "./onesignal.service.js";

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
  const { contentType, metadata = {} } = data;
  const { commentText, replyText } = metadata;

  // Helper function to truncate text if too long
  const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Get comment/reply text to display
  const displayText = commentText || replyText;
  const truncatedText = displayText ? truncateText(displayText) : "";

  const messages = {
    [NotificationType.NEW_FOLLOWER]: `${senderName} started following you`,
    [NotificationType.FOLLOW_REQUEST]: `${senderName} sent you a follow request`,
    [NotificationType.FOLLOW_REQUEST_ACCEPTED]: `${senderName} accepted your follow request`,
    
    [NotificationType.POST_LIKED]: `${senderName} liked your post`,
    [NotificationType.ZEAL_LIKED]: `${senderName} liked your zeal`,
    [NotificationType.WRITE_LIKED]: `${senderName} liked your write`,
    [NotificationType.COMMENT_LIKED]: `${senderName} liked your comment`,
    [NotificationType.AGGREGATED_LIKES]: `${senderName} and others liked your ${contentType === ContentType.POST ? "post" : contentType === ContentType.ZEAL ? "zeal" : "write"}`,
    
    [NotificationType.POST_COMMENT]: truncatedText 
      ? `${senderName} commented on your post: "${truncatedText}"`
      : `${senderName} commented on your post`,
    [NotificationType.ZEAL_COMMENT]: truncatedText 
      ? `${senderName} commented on your zeal: "${truncatedText}"`
      : `${senderName} commented on your zeal`,
    [NotificationType.WRITE_COMMENT]: truncatedText 
      ? `${senderName} commented on your write: "${truncatedText}"`
      : `${senderName} commented on your write`,
    [NotificationType.COMMENT_REPLY]: truncatedText 
      ? `${senderName} replied to your comment: "${truncatedText}"`
      : `${senderName} replied to your comment`,
    [NotificationType.MENTION_IN_COMMENT]: truncatedText 
      ? `${senderName} mentioned you in a comment: "${truncatedText}"`
      : `${senderName} mentioned you in a comment`,
    
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
 * @param {Object} metadata - Notification metadata (optional)
 * @returns {string} Aggregated notification message
 */
const generateAggregatedMessage = (type, firstSender, latestSender = null, count, contentType = null, metadata = {}) => {
  const firstSenderName = firstSender.name || firstSender.username;
  const latestSenderName = latestSender ? (latestSender.name || latestSender.username) : firstSenderName;

  // Helper function to truncate text if too long
  const truncateText = (text, maxLength = 100) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Get comment/reply text to display
  const displayText = metadata?.commentText || metadata?.replyText;
  const truncatedText = displayText ? truncateText(displayText) : "";

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
      return truncatedText 
        ? `${latestSenderName} commented on your ${contentLabel}: "${truncatedText}"`
        : `${latestSenderName} commented on your ${contentLabel}`;
    } else {
      const othersCount = count - 1;
      return truncatedText
        ? `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} commented on your ${contentLabel}. Latest: "${truncatedText}"`
        : `${firstSenderName} and ${othersCount} ${othersCount === 1 ? "other" : "others"} commented on your ${contentLabel}`;
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
  try {
    const {
      receiverId,
      senderId,
      type,
      contentType,
      contentId,
      message,
      metadata = {},
    } = notificationData;

    if (!receiverId || !senderId || !type || !message) {
      logger.error(`Missing required fields in createOrUpdateAggregatedNotification: receiverId=${receiverId}, senderId=${senderId}, type=${type}`);
      // Don't return null - let the calling function handle fallback
      throw new Error("Missing required fields in createOrUpdateAggregatedNotification");
    }

    const aggregationKey = generateAggregationKey(type, receiverId, contentType, contentId);

    // Get receiver user for push notifications
    let receiver = null;
    try {
      receiver = await User.findById(receiverId).select("oneSignalPlayerId pushNotificationEnabled");
      if (receiver && receiver.isDeleted) {
        logger.warn(`Receiver is deleted: ${receiverId}`);
        receiver = null;
      }
    } catch (receiverError) {
      logger.warn(`Error fetching receiver ${receiverId}:`, receiverError);
    }

    // If receiver not found, still continue to create notification
    if (!receiver) {
      logger.warn(`Receiver not found for aggregated notification: ${receiverId}, but continuing...`);
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

      // For comment notifications, if same user comments again, create new notification instead of updating
      const isCommentType = type === NotificationType.POST_COMMENT || 
                           type === NotificationType.ZEAL_COMMENT || 
                           type === NotificationType.WRITE_COMMENT ||
                           type === NotificationType.COMMENT_REPLY;

      if (senderExists && isCommentType) {
        // Same user commenting again - create new individual notification instead of updating
        logger.info(`Same user ${senderId} commenting again on ${contentType} ${contentId}, creating new notification instead of updating`);
        return null; // Return null to trigger individual notification creation
      }

      if (!senderExists) {
        // Get latest sender details
        let latestSender = null;
        try {
          latestSender = await User.findById(senderId).select("name username profileImage");
        } catch (senderError) {
          logger.warn(`Error fetching latest sender ${senderId}:`, senderError);
        }
        
        // Even if sender not found, we should still update the notification
        // Add new sender to aggregation
        existingNotification.aggregatedUserIds.push(senderId);
        existingNotification.aggregatedCount += 1;

        // Get first sender (already populated from query)
        const firstSender = existingNotification.aggregatedUserIds[0];
        
        if (firstSender) {
          const totalCount = existingNotification.aggregatedCount;
          // Update metadata with latest comment/reply text if available
          if (metadata.commentText || metadata.replyText) {
            existingNotification.metadata = {
              ...(existingNotification.metadata || {}),
              ...metadata, // Include all new metadata, prioritizing latest
            };
          }
          // Update imageUrl to latest sender's profileImage (if available)
          if (latestSender) {
            existingNotification.imageUrl = latestSender.profileImage || existingNotification.imageUrl || null;
          }
          existingNotification.message = generateAggregatedMessage(
            existingNotification.type,
            firstSender,
            latestSender || firstSender, // Use firstSender as fallback
            totalCount,
            existingNotification.contentType,
            existingNotification.metadata
          );
        }

        existingNotification.status = NotificationStatus.UNREAD;
        existingNotification.updatedAt = new Date();
        await existingNotification.save();

        // Verify notification was saved
        if (!existingNotification._id) {
          logger.error(`CRITICAL: Aggregated notification save failed - no _id`);
          throw new Error("Failed to save aggregated notification");
        }

        // Verify it exists in database
        const savedNotification = await Notification.findById(existingNotification._id);
        if (!savedNotification) {
          logger.error(`CRITICAL: Aggregated notification saved but not found in database: ${existingNotification._id}`);
          throw new Error("Notification was saved but not found in database");
        }

        logger.info(`Aggregated notification updated and saved: ${existingNotification._id}`);

        // Send push notification for aggregated update (non-blocking) - only after save
        if (receiver && latestSender) {
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
        } else if (receiver && !latestSender) {
          logger.warn(`Notification saved but push not sent - sender not found: ${senderId}`);
        }
      } else {
        logger.info(`Sender ${senderId} already exists in aggregated notification ${existingNotification._id}`);
      }

      return existingNotification;
    } else {
      // Get sender details for imageUrl
      let sender = null;
      try {
        sender = await User.findById(senderId).select("name username profileImage");
      } catch (senderError) {
        logger.warn(`Error fetching sender ${senderId}:`, senderError);
      }

      // If sender not found, still create notification with basic data
      if (!sender) {
        logger.warn(`Sender not found for aggregated notification: ${senderId}, but continuing...`);
      }

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
        imageUrl: sender ? sender.profileImage : null,
      });

      // Verify notification was saved
      if (!notification || !notification._id) {
        logger.error(`CRITICAL: New aggregated notification save failed - no _id`);
        throw new Error("Failed to save new aggregated notification");
      }

      // Explicitly save to ensure persistence (Notification.create already saves, but double-check)
      try {
        await notification.save();
      } catch (saveError) {
        logger.error(`Error saving aggregated notification:`, saveError);
        throw saveError;
      }
      
      // Verify it exists in database
      const savedNotification = await Notification.findById(notification._id);
      if (!savedNotification) {
        logger.error(`CRITICAL: Aggregated notification created but not found in database: ${notification._id}`);
        throw new Error("Notification was created but not found in database");
      }

      logger.info(`New aggregated notification created and saved: ${notification._id} for type: ${type}, receiverId: ${receiverId}, senderId: ${senderId}`);

      // Send push notification for new aggregated notification (non-blocking) - only after save
      if (receiver && sender) {
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
      } else {
        if (!receiver) {
          logger.warn(`Notification saved but push not sent - receiver not found: ${receiverId}`);
        }
        if (!sender) {
          logger.warn(`Notification saved but push not sent - sender not found: ${senderId}`);
        }
      }

      return notification;
    }
  } catch (error) {
    logger.error("Error in createOrUpdateAggregatedNotification:", error);
    logger.error("Error stack:", error.stack);
    return null;
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
  let notification = null;
  let sender = null;
  let receiver = null;
  let notificationMessage = null;
  let notificationImageUrl = null;

  try {
    const {
      receiverId,
      senderId,
      type,
      contentType = null,
      contentId = null,
      message = null,
      metadata = {},
      imageUrl = null,
    } = notificationData;

    // Log incoming request for debugging
    logger.info(`Creating notification - type: ${type}, receiverId: ${receiverId}, senderId: ${senderId}, contentType: ${contentType}, contentId: ${contentId}`);

    // Validate required fields
    if (!receiverId || !senderId || !type) {
      logger.error(`Missing required fields for notification: receiverId=${receiverId}, senderId=${senderId}, type=${type}`);
      // Cannot create notification without required fields
      return null;
    }

    // Don't create notification if user is notifying themselves
    if (receiverId.toString() === senderId.toString()) {
      logger.info(`Skipping self-notification: ${senderId}`);
      return null;
    }

    // Get sender user - but continue even if not found
    try {
      sender = await User.findById(senderId).select("name username profileImage");
    } catch (senderError) {
      logger.warn(`Error fetching sender ${senderId}:`, senderError);
    }

    // Get receiver user - but continue even if not found
    try {
      receiver = await User.findById(receiverId).select("_id oneSignalPlayerId pushNotificationEnabled");
      if (receiver && receiver.isDeleted) {
        logger.warn(`Receiver is deleted: ${receiverId}`);
        receiver = null;
      }
    } catch (receiverError) {
      logger.warn(`Error fetching receiver ${receiverId}:`, receiverError);
    }

    // Generate message if not provided - use fallback if generation fails
    try {
      if (message) {
        notificationMessage = message;
      } else if (sender) {
        notificationMessage = generateNotificationMessage(type, sender, { contentType, metadata });
      } else {
        // Fallback message if sender not found
        notificationMessage = `New ${type} notification`;
      }
    } catch (messageError) {
      logger.warn(`Error generating message:`, messageError);
      notificationMessage = message || `New ${type} notification`;
    }

    if (!notificationMessage) {
      notificationMessage = `New ${type} notification`;
    }

    // Always use sender's profileImage for imageUrl (unless explicitly provided)
    notificationImageUrl = imageUrl || (sender ? sender.profileImage : null) || null;

    // Check if this type supports aggregation
    if (isAggregatableType(type)) {
      // Use aggregation for likes, follows, comments
      try {
        notification = await createOrUpdateAggregatedNotification({
          receiverId,
          senderId,
          type,
          contentType,
          contentId,
          message: notificationMessage,
          metadata,
        });
        
        // If aggregation returns null, create individual notification
        if (!notification) {
          logger.warn(`Aggregated notification returned null, creating individual notification for type: ${type}`);
          try {
            notification = await Notification.create({
              receiverId,
              senderId,
              type,
              contentType,
              contentId,
              message: notificationMessage,
              metadata,
              status: NotificationStatus.UNREAD,
              imageUrl: notificationImageUrl,
            });
            // Verify it was saved
            if (!notification || !notification._id) {
              throw new Error("Failed to create fallback notification - no _id");
            }
            // Explicitly save to ensure persistence
            await notification.save();
            // Verify it exists in database
            const savedNotification = await Notification.findById(notification._id);
            if (!savedNotification) {
              throw new Error("Notification was created but not found in database");
            }
            logger.info(`Created individual notification (fallback from aggregation) for type: ${type} from ${senderId} to ${receiverId}, ID: ${notification._id}`);
          } catch (fallbackError) {
            logger.error(`Failed to create fallback notification:`, fallbackError);
            throw fallbackError;
          }
        } else {
          // Verify aggregated notification was saved
          if (!notification._id) {
            logger.error(`CRITICAL: Aggregated notification has no _id`);
            throw new Error("Aggregated notification has no _id");
          }
          // Verify it exists in database
          const savedNotification = await Notification.findById(notification._id);
          if (!savedNotification) {
            logger.error(`CRITICAL: Aggregated notification not found in database: ${notification._id}`);
            throw new Error("Aggregated notification not found in database");
          }
          logger.info(`Using aggregated notification: ${notification._id} for type: ${type}`);
        }
      } catch (aggError) {
        logger.error(`Error in createOrUpdateAggregatedNotification:`, aggError);
        // Fallback to individual notification if aggregation fails
        try {
          notification = await Notification.create({
            receiverId,
            senderId,
            type,
            contentType,
            contentId,
            message: notificationMessage,
            metadata,
            status: NotificationStatus.UNREAD,
            imageUrl: notificationImageUrl,
          });
          // Verify it was saved
          if (!notification || !notification._id) {
            throw new Error("Failed to create fallback notification - no _id");
          }
          // Explicitly save to ensure persistence
          await notification.save();
          // Verify it exists in database
          const savedNotification = await Notification.findById(notification._id);
          if (!savedNotification) {
            throw new Error("Notification was created but not found in database");
          }
          logger.info(`Created individual notification (fallback from error) for type: ${type} from ${senderId} to ${receiverId}, ID: ${notification._id}`);
        } catch (createError) {
          logger.error(`Failed to create fallback notification:`, createError);
          throw createError;
        }
      }
    } else {
      // Create individual notification
      try {
        notification = await Notification.create({
          receiverId,
          senderId,
          type,
          contentType,
          contentId,
          message: notificationMessage,
          metadata,
          status: NotificationStatus.UNREAD,
          imageUrl: notificationImageUrl,
        });
        // Verify it was saved
        if (!notification || !notification._id) {
          throw new Error("Failed to create individual notification - no _id");
        }
        // Explicitly save to ensure persistence
        await notification.save();
        // Verify it exists in database
        const savedNotification = await Notification.findById(notification._id);
        if (!savedNotification) {
          throw new Error("Notification was created but not found in database");
        }
        logger.info(`Notification created: ${type} from ${senderId} to ${receiverId}, ID: ${notification._id}`);
      } catch (createError) {
        logger.error(`Failed to create individual notification:`, createError);
        throw createError;
      }
    }

    // CRITICAL: Ensure notification is saved before sending push
    if (!notification) {
      logger.error(`CRITICAL: Notification was not created for type: ${type}, receiverId: ${receiverId}, senderId: ${senderId}`);
      // Try one more time to create notification
      try {
        notification = await Notification.create({
          receiverId,
          senderId,
          type,
          contentType,
          contentId,
          message: notificationMessage || `New ${type} notification`,
          metadata,
          status: NotificationStatus.UNREAD,
          imageUrl: notificationImageUrl,
        });
        // Explicitly save to ensure persistence
        await notification.save();
        // Verify it exists in database
        const savedNotification = await Notification.findById(notification._id);
        if (!savedNotification) {
          logger.error(`CRITICAL: Notification created but not found in database: ${notification._id}`);
          return null;
        }
        logger.warn(`Created notification in final check: ${notification._id}`);
      } catch (finalCreateError) {
        logger.error(`CRITICAL: Failed to create notification in final check:`, finalCreateError);
        return null;
      }
    }

    // Verify notification was actually saved by checking if it has an _id
    if (!notification || !notification._id) {
      logger.error(`CRITICAL: Notification object is invalid - no _id:`, notification);
      return null;
    }

    // Log successful notification creation
    logger.info(`Notification successfully created and saved: ${notification._id} for type: ${type}, receiverId: ${receiverId}, senderId: ${senderId}`);

    // Send push notification (non-blocking) - only if we have receiver and sender
    // But notification MUST be saved first
    if (receiver && sender) {
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
    } else {
      if (!receiver) {
        logger.warn(`Notification saved but push not sent - receiver not found: ${receiverId}`);
      }
      if (!sender) {
        logger.warn(`Notification saved but push not sent - sender not found: ${senderId}`);
      }
    }

    return notification;
  } catch (error) {
    logger.error("Error creating notification:", error);
    logger.error("Error stack:", error.stack);
    
    // Last resort: try to create a basic notification even if everything failed
    if (!notification) {
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

        // Only create if we have minimum required fields
        if (receiverId && senderId && type) {
          notification = await Notification.create({
            receiverId,
            senderId,
            type,
            contentType,
            contentId,
            message: message || notificationMessage || "Notification",
            metadata: { ...metadata, error: error.message, errorStack: error.stack },
            status: NotificationStatus.UNREAD,
            imageUrl: notificationImageUrl || null,
          });
          logger.warn(`Created emergency fallback notification: ${notification._id}`);
          return notification;
        } else {
          logger.error("CRITICAL: Cannot create emergency fallback - missing required fields");
          return null;
        }
      } catch (finalError) {
        logger.error("CRITICAL: Failed to create notification even in emergency fallback:", finalError);
        return null;
      }
    }
    
    // If we have a notification, return it even if there was an error
    return notification;
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
        imageUrl: notification.imageUrl || notification.senderId.profileImage || null,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt,
      };

      return formatted;
    });

    return {
      notifications: formattedNotifications,
      pagination: getPaginationMeta(total, page, limit),
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
      logger.warn(`Invalid OneSignal player ID detected for user: ${receiver._id}`);
      // Optionally remove invalid player IDs here
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

