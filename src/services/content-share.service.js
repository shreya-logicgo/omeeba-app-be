import ContentShare from "../models/interactions/ContentShare.js";
import Post from "../models/content/Post.js";
import WritePost from "../models/content/WritePost.js";
import ZealPost from "../models/content/ZealPost.js";
import Poll from "../models/content/Poll.js";
import User from "../models/users/User.js";
import { ContentType, ZealStatus, PollStatus, NotificationType, ChatType, MessageType, MessageStatus } from "../models/enums.js";
import { createNotification } from "./notification.service.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { sendMessage } from "./chatMessage.service.js";
import ChatRoom from "../models/chat/ChatRoom.js";

/**
 * Verify content exists and is accessible
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post, Poll)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object|null>} - Content document or null
 */
const verifyContentExists = async (contentType, contentId) => {
  try {
    let content = null;

    switch (contentType) {
      case ContentType.POST:
        content = await Post.findById(contentId);
        break;
      case ContentType.WRITE_POST:
        content = await WritePost.findById(contentId)
          .select('title content userId createdAt');
        break;
      case ContentType.ZEAL:
        content = await ZealPost.findOne({
          _id: contentId,
          status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] }, // Allow sharing published or ready zeal posts
        })
        .select('title description mediaUrl thumbnailUrl userId createdAt');
        break;
      case ContentType.POLL:
        content = await Poll.findOne({
          _id: contentId,
          // status: PollStatus.ACTIVE, // Only allow sharing active polls
        })
        .select('question options totalVotes expiresAt createdBy createdAt');
        break;
      default:
        return null;
    }

    return content;
  } catch (error) {
    logger.error("Error verifying content exists:", error);
    return null;
  }
};

/**
 * Validate receiver IDs (ensure they exist and are not deleted)
 * @param {Array<mongoose.Types.ObjectId>} receiverIds - Array of receiver user IDs
 * @param {mongoose.Types.ObjectId} senderId - Sender user ID (to exclude from receivers)
 * @returns {Promise<{valid: boolean, invalidIds: Array, message: string}>}
 */
const validateReceivers = async (receiverIds, senderId) => {
  try {
    // Remove duplicates
    const uniqueReceiverIds = [...new Set(receiverIds.map(id => id.toString()))];
    
    // Convert to ObjectIds
    const receiverObjectIds = uniqueReceiverIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    // Check if sender is in receivers list
    const senderIdStr = senderId.toString();
    if (uniqueReceiverIds.includes(senderIdStr)) {
      return {
        valid: false,
        invalidIds: [],
        message: "Cannot share content with yourself",
      };
    }

    // Validate all receivers exist and are not deleted
    const users = await User.find({
      _id: { $in: receiverObjectIds },
      isDeleted: false,
    }).select("_id");

    const foundIds = users.map((user) => user._id.toString());
    const invalidIds = uniqueReceiverIds.filter(
      (id) => !foundIds.includes(id)
    );

    if (invalidIds.length > 0) {
      return {
        valid: false,
        invalidIds,
        message: `Invalid or deleted user IDs: ${invalidIds.join(", ")}`,
      };
    }

    return {
      valid: true,
      invalidIds: [],
      message: "All receivers are valid",
      receiverObjectIds,
    };
  } catch (error) {
    logger.error("Error validating receivers:", error);
    return {
      valid: false,
      invalidIds: [],
      message: "Error validating receivers",
    };
  }
};

/**
 * Share content with one or more users
 * @param {mongoose.Types.ObjectId} senderId - User ID of the sender
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post, Poll)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @param {Array<mongoose.Types.ObjectId>} receiverIds - Array of receiver user IDs
 * @returns {Promise<Object>} - Share operation result
 */
export const shareContent = async (senderId, contentType, contentId, receiverIds) => {
  try {
    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      throw new Error("Invalid content type");
    }

    // Validate receiverIds array
    if (!Array.isArray(receiverIds) || receiverIds.length === 0) {
      throw new Error("At least one receiver is required");
    }

    // Verify content exists and is accessible
    logger.info(`Fetching content: ${contentType} ${contentId}`);
    const content = await verifyContentExists(contentType, contentId);
    logger.info(`Fetched content: ${JSON.stringify(content)}`);
    if (!content) {
      throw new Error("Content not found or not accessible");
    }

    // Validate receivers
    const receiverValidation = await validateReceivers(receiverIds, senderId);
    if (!receiverValidation.valid) {
      throw new Error(receiverValidation.message);
    }

    const receiverObjectIds = receiverValidation.receiverObjectIds;

    // ================= UNIQUE SENDER CHECK =================
    const alreadySharedByUser = await ContentShare.exists({
      contentType,
      contentId,
      senderId,
    });

    let createdShares = [];
    let newShareCount = 0;

    // ================= CREATE SHARES (NO DUPLICATES PER RECEIVER) =================
    for (const receiverId of receiverObjectIds) {
      try {
        const exists = await ContentShare.findOne({
          contentType,
          contentId,
          senderId,
          receiverIds: receiverId,
        });
        if (exists) continue;

        const newShare = await ContentShare.create({
          contentType,
          contentId,
          senderId,
          receiverIds: [receiverId],
          createdAt: new Date(),
        });

        createdShares.push(newShare);
        newShareCount++;
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }

    // ================= CHAT MESSAGE CREATION =================
    try {
      for (const share of createdShares) {
        const receiverId = share.receiverIds[0];
        
        // Check if chat room exists between sender and receiver
        const existingRoom = await ChatRoom.findOne({
          $or: [
            { userA: senderId, userB: receiverId },
            { userA: receiverId, userB: senderId }
          ]
        });

        if (existingRoom) {
          // Determine message type based on content type
          let messageType = MessageType.TEXT;
          let messageText = "";
          let contentData = null;
          
          switch (contentType) {
            case ContentType.POST:
              messageType = MessageType.POST;
              messageText = "Shared a post";
              // For posts, we can just send the contentId and let the frontend fetch details
              break;
            case ContentType.WRITE_POST:
              messageType = MessageType.WRITE_POST;
              messageText = "Shared a write post";
              // For write posts, include the actual content data since it's text-based
              if (content && content.title) {
                contentData = {
                  title: content.title,
                  content: content.content,
                  excerpt: content.content ? content.content.substring(0, 150) + (content.content.length > 150 ? "..." : "") : "",
                  author: content.userId
                };
                logger.info(`Write post content data prepared: ${JSON.stringify(contentData)}`);
              } else {
                logger.warn(`Write post content missing required fields: ${JSON.stringify(content)}`);
              }
              break;
            case ContentType.ZEAL:
              messageType = MessageType.ZEAL;
              messageText = "Shared a zeal";
              // For zeal posts, include the actual content data since it has media
              if (content) {
                contentData = {
                  title: content.title,
                  description: content.description,
                  mediaUrl: content.mediaUrl,
                  thumbnailUrl: content.thumbnailUrl,
                  userId: content.userId
                };
                logger.info(`Zeal content data prepared: ${JSON.stringify(contentData)}`);
              } else {
                logger.warn(`Zeal content missing required fields: ${JSON.stringify(content)}`);
              }
              break;
            case ContentType.POLL:
              messageType = MessageType.POLL;
              messageText = "Shared a poll";
              // For polls, include the actual poll data since it's important for preview
              if (content && content.question) {
                contentData = {
                  question: content.question,
                  options: content.options,
                  totalVotes: content.totalVotes || 0,
                  expiresAt: content.expiresAt,
                  createdBy: content.createdBy
                };
                logger.info(`Poll content data prepared: ${JSON.stringify(contentData)}`);
              } else {
                logger.warn(`Poll content missing required fields: ${JSON.stringify(content)}`);
              }
              break;
          }

          // Create chat message with content reference and data
          logger.info(`Preparing to send message with contentData: ${JSON.stringify(contentData)}`);
          await sendMessage(existingRoom._id.toString(), senderId, {
            messageType,
            message: messageText,
            contentId: contentId.toString(),
            contentType,
            contentData, // Include actual content data for polls and write posts
          });
        }
      }
    } catch (chatError) {
      logger.error("Error creating chat messages for shares:", chatError);
      // Don't fail the share operation if chat message creation fails
    }

    // Increment share count on the content document (atomic operation)
    // This tracks share count for analytics and virality tracking
    let updatedContent = null;
    try {
      if (!alreadySharedByUser && newShareCount > 0) {
        switch (contentType) {
          case ContentType.POST:
            await Post.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } });
            break;
          case ContentType.WRITE_POST:
            await WritePost.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } });
            break;
          case ContentType.ZEAL:
            await ZealPost.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } });
            break;
          case ContentType.POLL:
            await Poll.findByIdAndUpdate(contentId, { $inc: { shareCount: 1 } });
            break;
        }
      }
    } catch (err) {
      logger.error("Error updating share count:", err);
    }

    // ================= TOTAL SHARE COUNT (UNIQUE SENDERS) =================
    const totalShareCount = await ContentShare.distinct("senderId", {
      contentType,
      contentId,
    }).then((ids) => ids.length);

    // Create notifications
    try {
      // Poll uses 'createdBy' instead of 'userId'
      const contentOwnerId = content.userId || content.createdBy;

      // Notify content owner (if not self-share)
      if (contentOwnerId.toString() !== senderId.toString()) {
        await createNotification({
          receiverId: contentOwnerId,
          senderId,
          type: NotificationType.CONTENT_SHARED,
          contentType,
          contentId,
        });
      }

      // Notify receivers
      await Promise.all(
        receiverObjectIds.map((receiverId) => {
          if (
            receiverId.toString() !== senderId.toString() &&
            receiverId.toString() !== contentOwnerId.toString()
          ) {
            return createNotification({
              receiverId,
              senderId,
              type: NotificationType.CONTENT_SHARED_WITH_YOU,
              contentType,
              contentId,
            });
          }
          return null;
        })
      );
    } catch (err) {
      logger.error("Error creating notifications:", err);
    }

    // ================= ANALYTICS LOG =================
    logger.info(
      `[SHARE_EVENT] Content shared: ${contentType} ${contentId} by user ${senderId} with ${receiverObjectIds.length} receiver(s). Total unique senders: ${totalShareCount}`
    );

    // ================= FINAL RESPONSE =================
    return {
      success: true,
      shareCount: totalShareCount,
      totalShareCount,
      receiverIds: receiverObjectIds.map((id) => id.toString()),
      shares: createdShares.map((share) => ({
        id: share._id,
        contentType: share.contentType,
        contentId: share.contentId,
        senderId: share.senderId,
        receiverId: share.receiverIds[0],
        createdAt: share.createdAt,
      })),
    };
  } catch (error) {
    logger.error("Error in shareContent:", error);
    throw error;
  }
};

/**
 * Get shares sent by a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {Object} options - Query options (page, limit)
 * @returns {Promise<Object>} - Paginated shares sent by user
 */
export const getSharesSentByUser = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const shares = await ContentShare.find({ senderId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "name username profileImage isAccountVerified isVerifiedBadge")
      .populate("receiverIds", "name username profileImage isAccountVerified isVerifiedBadge")
      .populate({
        path: "contentId",
        select: "caption images videos userId createdAt",
        populate: {
          path: "userId",
          select: "name username profileImage isAccountVerified isVerifiedBadge",
        },
      })
      .lean();

    const total = await ContentShare.countDocuments({ senderId: userId });

    return {
      shares,
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getSharesSentByUser:", error);
    throw error;
  }
};

/**
 * Get shares received by a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {Object} options - Query options (page, limit)
 * @returns {Promise<Object>} - Paginated shares received by user
 */
export const getSharesReceivedByUser = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const shares = await ContentShare.find({ receiverIds: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("senderId", "name username profileImage isAccountVerified isVerifiedBadge")
      .populate("receiverIds", "name username profileImage isAccountVerified isVerifiedBadge")
      .populate({
        path: "contentId",
        select: "caption images videos userId createdAt",
        populate: {
          path: "userId",
          select: "name username profileImage isAccountVerified isVerifiedBadge",
        },
      })
      .lean();

    const total = await ContentShare.countDocuments({ receiverIds: userId });

    return {
      shares,
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getSharesReceivedByUser:", error);
    throw error;
  }
};

/**
 * Get share count for specific content
 * Returns count from ContentShare collection (source of truth for accuracy)
 * For faster reads, can also check content.shareCount field
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @param {boolean} useCached - If true, returns cached shareCount from content document (faster but may be slightly outdated)
 * @returns {Promise<number>} - Total share count
 */
export const getContentShareCount = async (contentType, contentId, useCached = false) => {
  try {
    // If useCached is true, try to get from content document first (faster)
    if (useCached) {
      let content = null;
      switch (contentType) {
        case ContentType.POST:
          content = await Post.findById(contentId).select("shareCount").lean();
          break;
        case ContentType.WRITE_POST:
          content = await WritePost.findById(contentId).select("shareCount").lean();
          break;
        case ContentType.ZEAL:
          content = await ZealPost.findById(contentId).select("shareCount").lean();
          break;
        case ContentType.POLL:
          content = await Poll.findById(contentId).select("shareCount").lean();
          break;
      }
      
      if (content && content.shareCount !== undefined) {
        return content.shareCount;
      }
    }

    // Always use ContentShare collection as source of truth for accuracy
    return await ContentShare.countDocuments({
      contentType,
      contentId,
    });
  } catch (error) {
    logger.error("Error in getContentShareCount:", error);
    return 0;
  }
};

export default {
  shareContent,
  getSharesSentByUser,
  getSharesReceivedByUser,
  getContentShareCount,
};

