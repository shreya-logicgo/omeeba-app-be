import ContentShare from "../models/interactions/ContentShare.js";
import Post from "../models/content/Post.js";
import WritePost from "../models/content/WritePost.js";
import ZealPost from "../models/content/ZealPost.js";
import User from "../models/users/User.js";
import { ContentType, ZealStatus } from "../models/enums.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";

/**
 * Verify content exists and is accessible
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
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
        content = await WritePost.findById(contentId);
        break;
      case ContentType.ZEAL:
        content = await ZealPost.findOne({
          _id: contentId,
          status: ZealStatus.PUBLISHED, // Only allow sharing published zeal posts
        });
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
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
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
    const content = await verifyContentExists(contentType, contentId);
    if (!content) {
      throw new Error("Content not found or not accessible");
    }

    // Validate receivers
    const receiverValidation = await validateReceivers(receiverIds, senderId);
    if (!receiverValidation.valid) {
      throw new Error(receiverValidation.message);
    }

    const receiverObjectIds = receiverValidation.receiverObjectIds;

    // Create share records (one per receiver for better querying and future chat integration)
    // Each record represents one share event to one receiver
    const shareRecords = receiverObjectIds.map((receiverId) => ({
      contentType,
      contentId,
      senderId,
      receiverIds: [receiverId], // Store single receiver per record for easier querying
      createdAt: new Date(),
    }));

    // Insert all share records
    const createdShares = await ContentShare.insertMany(shareRecords);

    logger.info(
      `Content shared: ${contentType} ${contentId} by user ${senderId} with ${receiverObjectIds.length} receiver(s)`
    );

    return {
      success: true,
      shareCount: createdShares.length,
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
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
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
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error("Error in getSharesReceivedByUser:", error);
    throw error;
  }
};

/**
 * Get share count for specific content
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<number>} - Total share count
 */
export const getContentShareCount = async (contentType, contentId) => {
  try {
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

