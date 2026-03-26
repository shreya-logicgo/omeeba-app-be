/**
 * Notification Service
 * Handles notification creation, aggregation, and retrieval
 */

import Notification from "../models/notifications/Notification.js";
import User from "../models/users/User.js";
import UserFollower from "../models/users/UserFollower.js";
import { NotificationType, NotificationStatus, ContentType } from "../models/enums.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import { sendPushNotificationToUser } from "./onesignal.service.js";
import { getContentModel } from "../models/utils/contentHelper.js";
import mongoose from "mongoose";

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
    NotificationType.POST_COMMENT,
    NotificationType.ZEAL_COMMENT,
    NotificationType.WRITE_COMMENT,
    NotificationType.POLL_COMMENT,
    NotificationType.POLL_VOTED,
  ];
  // TAG notifications should NOT be aggregated to prevent duplicates
  return aggregatableTypes.includes(type) && type !== NotificationType.TAG;
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
    [NotificationType.NEW_FOLLOWER]: `Started following you`,
    [NotificationType.FOLLOW_REQUEST]: `Sent you a follow request`,
    [NotificationType.FOLLOW_REQUEST_ACCEPTED]: `Accepted your follow request`,

    [NotificationType.POST_LIKED]: `Liked your post`,
    [NotificationType.ZEAL_LIKED]: `Liked your zeal`,
    [NotificationType.WRITE_LIKED]: `Liked your write`,
    [NotificationType.COMMENT_LIKED]: `Liked your comment`,
    [NotificationType.AGGREGATED_LIKES]: `Others liked your ${contentType === ContentType.POST ? "post" : contentType === ContentType.ZEAL ? "zeal" : "write"}`,
    
    [NotificationType.POST_COMMENT]: truncatedText 
      ? `Commented on your post: "${truncatedText}"`
      : `Commented on your post`,
    [NotificationType.ZEAL_COMMENT]: truncatedText 
      ? `Commented on your zeal: "${truncatedText}"`
      : `Commented on your zeal`,
    [NotificationType.WRITE_COMMENT]: truncatedText 
      ? `Commented on your write: "${truncatedText}"`
      : `Commented on your write`,
    [NotificationType.POLL_COMMENT]: truncatedText 
      ? `Commented on your poll: "${truncatedText}"`
      : `Commented on your poll`,
    [NotificationType.COMMENT_REPLY]: truncatedText 
      ? `Replied to your comment: "${truncatedText}"`
      : `Replied to your comment`,
    [NotificationType.MENTION_IN_COMMENT]: truncatedText 
      ? `Mentioned you in a comment: "${truncatedText}"`
      : `Mentioned you in a comment`,
    
    [NotificationType.MENTION_IN_POST]: `Mentioned you in a post`,
    [NotificationType.MENTION_IN_ZEAL]: `Mentioned you in a zeal`,
    [NotificationType.MENTION_IN_WRITE]: `Mentioned you in a write`,
    
    [NotificationType.TAG]: `tagged you in a post`,
    
    [NotificationType.CONTENT_SHARED]: `Shared your ${contentType === ContentType.POST ? "post" : contentType === ContentType.ZEAL ? "zeal" : "write"}`,
    [NotificationType.CONTENT_SHARED_WITH_YOU]: `Shared a ${contentType === ContentType.POST ? "post" : contentType === ContentType.ZEAL ? "zeal" : "write"} with you`,
    
    [NotificationType.NEW_SNAP_RECEIVED]: `Sent you a snap`,
    [NotificationType.SNAP_VIEWED]: `Viewed your snap`,
    
    [NotificationType.POLL_VOTED]: `Voted on your poll`,
    [NotificationType.POLL_ENDED]: `Your poll has ended`,
    
    [NotificationType.VERIFIED_BADGE_ACTIVATED]: `Your verified badge has been activated`,
    [NotificationType.VERIFIED_BADGE_EXPIRED]: `Your verified badge has expired`,
    [NotificationType.SUBSCRIPTION_PAYMENT_SUCCESS]: `Your subscription payment was successful`,
    
    [NotificationType.CONTENT_REPORTED]: `Your content has been reported`,
    [NotificationType.MODERATION_ACTION]: `Moderation action has been taken on your content`,

    [NotificationType.NEW_MESSAGE]: `Sent you a message: "${truncatedText || "New message"}"`,
  };

  return messages[type] || `Interacted with your content`;
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
    if (contentType === ContentType.POLL) return "poll";
    return "content";
  };

  const contentLabel = getContentLabel();

  // Generate message based on notification type
  if (type === NotificationType.POST_LIKED || 
      type === NotificationType.ZEAL_LIKED || 
      type === NotificationType.WRITE_LIKED) {
    if (count === 1) {
      return `Someone liked your ${contentLabel}`;
    } else {
      const othersCount = count - 1;
      return `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} liked your ${contentLabel}`;
    }
  }

  if (type === NotificationType.COMMENT_LIKED) {
    if (count === 1) {
      return `Someone liked your comment`;
    } else {
      const othersCount = count - 1;
      return `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} liked your comment`;
    }
  }

  if (type === NotificationType.NEW_FOLLOWER) {
    if (count === 1) {
      return `Someone started following you`;
    } 
    // else {
    //   const othersCount = count - 1;
    //   return `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} started following you`;
    // }
  }

  if (type === NotificationType.POST_COMMENT || 
      type === NotificationType.ZEAL_COMMENT || 
      type === NotificationType.WRITE_COMMENT ||
      type === NotificationType.POLL_COMMENT) {
    if (count === 1) {
      return truncatedText 
        ? `Someone commented on your ${contentLabel}: "${truncatedText}"`
        : `Someone commented on your ${contentLabel}`;
    } else {
      const othersCount = count - 1;
      return truncatedText
        ? `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} commented on your ${contentLabel}. Latest: "${truncatedText}"`
        : `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} commented on your ${contentLabel}`;
    }
  }

  if (type === NotificationType.POLL_VOTED) {
    if (count === 1) {
      return `Someone voted on your poll`;
    } else {
      const othersCount = count - 1;
      return `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} voted on your poll`;
    }
  }

  if (type === NotificationType.NEW_MESSAGE) {
    if (count === 1) {
      return truncatedText
        ? `Someone sent you a message: "${truncatedText}"`
        : `Someone sent you a message`;
    } else {
      const othersCount = count - 1;
      return `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} sent you messages`;
    }
  }

  // Default fallback
  if (count === 1) {
    return `Someone interacted with your ${contentLabel}`;
  } else {
    const othersCount = count - 1;
    return `Someone and ${othersCount} ${othersCount === 1 ? "other" : "others"} interacted with your ${contentLabel}`;
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
      imageUrl = null,
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
                           type === NotificationType.POLL_COMMENT ||
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
        imageUrl: imageUrl || (sender ? sender.profileImage : null),
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

    // Automatically fetch content images if needed
    let finalImageUrl = imageUrl;
    if (!finalImageUrl && contentId) {
      try {
        if (contentType === ContentType.ZEAL) {
          logger.info(`Fetching Zeal thumbnail for notification: ${contentId}`);
          const ZealPostModel = getContentModel(ContentType.ZEAL);
          const zealPost = await ZealPostModel.findById(contentId).select("thumbnailUrl");
          if (zealPost && zealPost.thumbnailUrl) {
            finalImageUrl = zealPost.thumbnailUrl;
            logger.info(`Zeal thumbnail fetched: ${finalImageUrl}`);
          }
        } else if (contentType === ContentType.POST) {
          logger.info(`Fetching Post images for notification: ${contentId}`);
          const PostModel = getContentModel(ContentType.POST);
          const post = await PostModel.findById(contentId).select("images");
          if (post && post.images && post.images.length > 0) {
            finalImageUrl = post.images[0]; // Use first image
            logger.info(`Post first image fetched: ${finalImageUrl}`);
          } else {
            logger.info(`No images found in post: ${contentId}`);
          }
        }
      } catch (err) {
        logger.warn(`Error fetching content image for notification: ${err.message}`);
      }
    }

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

    // ====== DEDUPLICATION GUARD (prevent duplicate notifications & double OneSignal push) ======
    // If an identical notification (same receiver, sender, type, contentType, contentId)
    // was created very recently, don't create/send another one.
    try {
      const recentWindow = new Date(Date.now() - 5 * 1000); // last 5 seconds
      const existingRecent = await Notification.findOne({
        receiverId,
        senderId,
        type,
        contentType: contentType || null,
        contentId: contentId || null,
        createdAt: { $gte: recentWindow },
      }).lean();

      if (existingRecent) {
        logger.warn(
          `Skipping duplicate notification (type=${type}) for receiver=${receiverId}, sender=${senderId}, contentType=${contentType}, contentId=${contentId}`
        );
        return null;
      }
    } catch (dedupeError) {
      logger.warn("Error checking for duplicate notification (continuing without dedupe):", dedupeError);
    }
    // ====== END DEDUPLICATION GUARD ======

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
    notificationImageUrl = finalImageUrl || (sender ? sender.profileImage : null) || null;

    // Check if this type should be push-only (not saved to DB)
    const isPushOnlyType = type === NotificationType.NEW_MESSAGE;

    if (isPushOnlyType) {
      logger.info(`Skipping database creation for push-only notification type: ${type}`);

      // Still send push notification (non-blocking)
      if (receiver && sender) {
        sendPushNotificationAsync(receiver, sender, notificationMessage, notificationImageUrl, {
          notificationId: null, // No DB ID for push-only
          type: type,
          contentType: contentType || null,
          contentId: contentId ? contentId.toString() : null,
          ...metadata,
        }).catch((error) => {
          logger.error("Failed to send push notification for push-only type:", error);
        });
      }

      return {
        isPushOnly: true,
        type,
        message: notificationMessage,
        receiverId,
        senderId
      };
    }

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
          imageUrl: finalImageUrl,
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
      sendPushNotificationAsync(receiver, sender, notificationMessage, notification.imageUrl || notificationImageUrl, {
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

    // Batch check follow status for NEW_FOLLOWER notifications
    const newFollowerNotifications = notifications.filter(
      (n) => n.type === NotificationType.NEW_FOLLOWER && n.senderId
    );
    const senderIdsToCheck = newFollowerNotifications
      .map((n) => n.senderId?._id?.toString())
      .filter((id) => id);

    const followingMap = new Map();
    if (senderIdsToCheck.length > 0) {
      try {
        const followRelations = await UserFollower.find({
          userId: { $in: senderIdsToCheck.map((id) => new mongoose.Types.ObjectId(id)) },
          followerId: userId,
        })
          .select("userId")
          .lean();

        followRelations.forEach((rel) => {
          const id = rel.userId ? rel.userId.toString() : null;
          if (id) followingMap.set(id, true);
        });
      } catch (followError) {
        logger.warn(`Error batch checking follow status:`, followError);
      }
    }

    // Format notifications and populate contentId
    const formattedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        let content = null;

        // Populate contentId based on contentType - get image data
        if (notification.contentType && notification.contentId) {
          try {
            const ContentModel = getContentModel(notification.contentType);
            if (ContentModel) {
              // Select relevant fields based on content type
              let selectFields = "images videos";
              if (notification.contentType === ContentType.ZEAL) {
                selectFields = "images videos thumbnailUrl"; // Zeal has thumbnailUrl
              }

              content = await ContentModel.findById(notification.contentId)
                .select(selectFields)
                .lean();

              // Format content with image field
              if (content) {
                let imageUrl = null;
                let imagesArray = Array.isArray(content.images) ? [...content.images] : [];

                // Determine image URL based on content type
                if (notification.contentType === ContentType.ZEAL) {
                  // For Zeal: 
                  // 1. If thumbnail exists: use it for image and images array
                  // 2. If no thumbnail but has images: use first image for image and images array
                  // 3. If no thumbnail and no images (only videos): image = null, images = []

                  if (content.thumbnailUrl) {
                    // Has thumbnail: use thumbnail for image and images
                    imageUrl = content.thumbnailUrl;
                    const thumbnailStr = String(content.thumbnailUrl);
                    const thumbnailExists = imagesArray.some(img => String(img) === thumbnailStr);
                    if (!thumbnailExists) {
                      imagesArray = [content.thumbnailUrl, ...imagesArray];
                    } else {
                      // Ensure thumbnail is first in array
                      imagesArray = imagesArray.filter(img => String(img) !== thumbnailStr);
                      imagesArray = [content.thumbnailUrl, ...imagesArray];
                    }
                  } else if (imagesArray.length > 0) {
                    // No thumbnail but has images: use first image
                    imageUrl = imagesArray[0];
                    // imagesArray already contains the image, no change needed
                  } else {
                    // No thumbnail and no images (only videos): image = null, images = []
                    imageUrl = null;
                    imagesArray = [];
                  }
                } else if (notification.contentType === ContentType.POST) {
                  // For Post: use first image
                  imageUrl = imagesArray.length > 0 ? imagesArray[0] : null;

                  // Ensure that if we have a single image, it's in the images array
                  if (imageUrl && !imagesArray.includes(imageUrl)) {
                    imagesArray = [imageUrl, ...imagesArray];
                  }
                } else if (notification.contentType === ContentType.WRITE_POST) {
                  // WritePost doesn't have images, so null
                  imageUrl = null;
                  imagesArray = [];
                }

                content = {
                  _id: content._id,
                  image: imageUrl, // Single image URL for notification display
                  images: imagesArray, // Array of images - ensures single images are included
                  videos: content.videos || null,
                };
              }
            }
          } catch (contentError) {
            logger.warn(`Error populating content for notification ${notification._id}:`, contentError);
            // Continue without content if population fails
          }
        }

        // Check if current user follows the sender (for NEW_FOLLOWER notifications)
        let isFollowingSender = null;
        if (notification.type === NotificationType.NEW_FOLLOWER && notification.senderId) {
          const senderIdStr = notification.senderId._id?.toString();
          isFollowingSender = senderIdStr ? followingMap.has(senderIdStr) : false;
        }

        const formatted = {
          id: notification._id.toString(),
          type: notification.type,
          message: notification.message,
          status: notification.status,
          contentType: notification.contentType,
          contentId: notification.contentId
            ? notification.contentId.toString()
            : null,
          content: content, // Populated content object
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
          isFollowingSender: isFollowingSender, // true/false/null - only for NEW_FOLLOWER type
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
      })
    );

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
 * @param {Object} data - Additional data payload (notificationId, type, contentType, contentId, metadata, etc.)
 *
 * NOTE:
 * - The OneSignal data payload matches the exact format of the notification list API response
 * - This ensures consistency between push notifications and the getNotifications API
 */
const sendPushNotificationAsync = async (receiver, sender, message, imageUrl = null, data = {}) => {
  try {
    // Prepare notification payload (title/body/image for OneSignal UI)
    const notificationPayload = {
      title: sender.name || sender.username || "Omeeba",
      body: message,
      imageUrl: imageUrl || sender.profileImage || null,
    };

    // Fetch notification from database to get all fields (status, createdAt, updatedAt, etc.)
    let notification = null;
    if (data.notificationId) {
      try {
        notification = await Notification.findById(data.notificationId)
          .populate("senderId", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("aggregatedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
          .lean();
      } catch (fetchError) {
        logger.warn(`Could not fetch notification ${data.notificationId} for push payload:`, fetchError);
      }
    }

    // Format notification exactly like getNotifications API response
    let formattedNotification = null;
    if (notification) {
      // Get content if contentType and contentId exist
      let content = null;
      if (notification.contentType && notification.contentId) {
        try {
          const ContentModel = getContentModel(notification.contentType);
          if (ContentModel) {
            let selectFields = "images videos";
            if (notification.contentType === ContentType.ZEAL) {
              selectFields = "images videos thumbnailUrl";
            }

            const contentDoc = await ContentModel.findById(notification.contentId)
              .select(selectFields)
              .lean();

            if (contentDoc) {
              let imageUrl = null;
              let imagesArray = Array.isArray(contentDoc.images) ? [...contentDoc.images] : [];

              if (notification.contentType === ContentType.ZEAL) {
                if (contentDoc.thumbnailUrl) {
                  imageUrl = contentDoc.thumbnailUrl;
                  const thumbnailStr = String(contentDoc.thumbnailUrl);
                  const thumbnailExists = imagesArray.some(img => String(img) === thumbnailStr);
                  if (!thumbnailExists) {
                    imagesArray = [contentDoc.thumbnailUrl, ...imagesArray];
                  } else {
                    imagesArray = imagesArray.filter(img => String(img) !== thumbnailStr);
                    imagesArray = [contentDoc.thumbnailUrl, ...imagesArray];
                  }
                } else if (imagesArray.length > 0) {
                  imageUrl = imagesArray[0];
                } else {
                  imageUrl = null;
                  imagesArray = [];
                }
              } else if (notification.contentType === ContentType.POST) {
                imageUrl = imagesArray.length > 0 ? imagesArray[0] : null;
                if (imageUrl && !imagesArray.includes(imageUrl)) {
                  imagesArray = [imageUrl, ...imagesArray];
                }
              } else if (notification.contentType === ContentType.WRITE_POST) {
                imageUrl = null;
                imagesArray = [];
              }

              content = {
                _id: contentDoc._id,
                image: imageUrl,
                images: imagesArray,
                videos: contentDoc.videos || null,
              };
            }
          }
        } catch (contentError) {
          logger.warn(`Error populating content for notification ${notification._id}:`, contentError);
        }
      }

      // Check if current user follows the sender (for NEW_FOLLOWER notifications)
      let isFollowingSender = null;
      if (notification.type === NotificationType.NEW_FOLLOWER && notification.senderId) {
        try {
          const senderIdStr = notification.senderId._id?.toString();
          if (senderIdStr && receiver?._id) {
            const followRelation = await UserFollower.findOne({
              userId: new mongoose.Types.ObjectId(senderIdStr),
              followerId: receiver._id,
            }).lean();
            isFollowingSender = followRelation ? true : false;
          }
        } catch (followError) {
          logger.warn(`Error checking follow status for push notification:`, followError);
          isFollowingSender = null;
        }
      }

      // Format exactly like getNotifications API - same structure for ALL notification types
      formattedNotification = {
        id: notification._id.toString(),
        type: notification.type,
        message: notification.message || message,
        status: notification.status || NotificationStatus.UNREAD,
        contentType: notification.contentType || null,
        contentId: notification.contentId ? notification.contentId.toString() : null,
        content: content, // Populated content object or null
        sender: notification.senderId
          ? {
            id: notification.senderId._id.toString(),
            name: notification.senderId.name,
            username: notification.senderId.username,
            profileImage: notification.senderId.profileImage,
            isAccountVerified: notification.senderId.isAccountVerified || false,
            isVerifiedBadge: notification.senderId.isVerifiedBadge || false,
          }
          : sender
            ? {
              id: sender._id?.toString() || sender._id || null,
              name: sender.name || null,
              username: sender.username || null,
              profileImage: sender.profileImage || null,
              isAccountVerified: sender.isAccountVerified || false,
              isVerifiedBadge: sender.isVerifiedBadge || false,
            }
            : null,
        isFollowingSender: isFollowingSender, // true/false/null - only for NEW_FOLLOWER type, null for others
        isAggregated: notification.isAggregated || false,
        aggregatedCount: notification.aggregatedCount || 0,
        aggregatedUsers: (notification.aggregatedUserIds || []).map((user) => ({
          id: user._id.toString(),
          name: user.name,
          username: user.username,
          profileImage: user.profileImage,
          isAccountVerified: user.isAccountVerified || false,
          isVerifiedBadge: user.isVerifiedBadge || false,
        })),
        metadata: notification.metadata || {},
        imageUrl: notification.imageUrl || notification.senderId?.profileImage || sender?.profileImage || null,
        createdAt: notification.createdAt || new Date(),
        updatedAt: notification.updatedAt || new Date(),
      };
    } else {
      // Fallback: construct from data if notification not found in DB
      // Check isFollowingSender for NEW_FOLLOWER type
      let isFollowingSender = null;
      if (data.type === NotificationType.NEW_FOLLOWER && sender?._id && receiver?._id) {
        try {
          const senderIdStr = sender._id.toString();
          const followRelation = await UserFollower.findOne({
            userId: new mongoose.Types.ObjectId(senderIdStr),
            followerId: receiver._id,
          }).lean();
          isFollowingSender = followRelation ? true : false;
        } catch (followError) {
          logger.warn(`Error checking follow status for push notification (fallback):`, followError);
          isFollowingSender = null;
        }
      }

      formattedNotification = {
        id: data.notificationId || null,
        type: data.type || null,
        message: message,
        status: NotificationStatus.UNREAD,
        contentType: data.contentType || null,
        contentId: data.contentId || null,
        content: null,
        sender: sender
          ? {
            id: sender._id?.toString() || sender._id || null,
            name: sender.name || null,
            username: sender.username || null,
            profileImage: sender.profileImage || null,
            isAccountVerified: sender.isAccountVerified || false,
            isVerifiedBadge: sender.isVerifiedBadge || false,
          }
          : null,
        isFollowingSender: isFollowingSender, // true/false/null - only for NEW_FOLLOWER type, null for others
        isAggregated: data.isAggregated ?? false,
        aggregatedCount: data.aggregatedCount ?? 0,
        aggregatedUsers: [],
        metadata: data.metadata || {},
        imageUrl: sender?.profileImage || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    // Final data sent to OneSignal - matches notification list API response format exactly
    const pushData = formattedNotification;

    // Debug log: full OneSignal payload snapshot
    console.log("=== OneSignal Push Payload ===");
    console.log("Receiver User ID:", receiver?._id?.toString?.() || receiver?._id || null);
    console.log("Notification Payload (title/body/image):", JSON.stringify(notificationPayload, null, 2));
    console.log("OneSignal Data (data payload):", JSON.stringify(pushData, null, 2));
    console.log("================================");

    // Send push notification
    await sendPushNotificationToUser(receiver, notificationPayload, pushData);
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
