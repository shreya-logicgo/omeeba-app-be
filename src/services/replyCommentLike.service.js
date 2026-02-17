/**
 * Reply Comment Like Service
 * Business logic for reply comment like operations
 */

import mongoose from "mongoose";
import ReplyCommentLike from "../models/comments/ReplyCommentLike.js";
import ReplyComment from "../models/comments/ReplyComment.js";
import { User } from "../models/index.js";
import { formatNumber } from "../utils/timeAgo.js";
import logger from "../utils/logger.js";

/**
 * Toggle like on a reply comment (like if not liked, unlike if already liked)
 * @param {string} userId - User ID liking/unliking the reply
 * @param {string} replyCommentId - Reply comment ID
 * @returns {Promise<Object>} Like status and count
 */
export const toggleReplyCommentLike = async (userId, replyCommentId) => {
  try {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Validate reply exists and is not deleted
    const reply = await ReplyComment.findById(replyCommentId);
    if (!reply || reply.isDeleted) {
      throw new Error("Reply not found");
    }

    // Check if user has already liked this reply
    const existingLike = await ReplyCommentLike.findOne({
      replyCommentId,
      userId,
    });

    let isLiked;
    let likeCount;

    if (existingLike) {
      // Unlike: remove the like
      await ReplyCommentLike.findByIdAndDelete(existingLike._id);
      isLiked = false;
      likeCount = await ReplyCommentLike.countDocuments({ replyCommentId });
      logger.info(`Reply ${replyCommentId} unliked by user ${userId}`);
    } else {
      // Like: create new like
      await ReplyCommentLike.create({
        replyCommentId,
        userId,
      });
      isLiked = true;
      likeCount = await ReplyCommentLike.countDocuments({ replyCommentId });
      logger.info(`Reply ${replyCommentId} liked by user ${userId}`);
    }

    const likeCountFormatted = formatNumber(likeCount);

    return {
      replyCommentId: replyCommentId.toString(),
      isLiked,
      likeCount,
      likeCountFormatted,
    };
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("You have already liked this reply");
    }
    logger.error("Error in toggleReplyCommentLike:", error);
    throw error;
  }
};

/**
 * Get like count for a reply comment
 * @param {string} replyCommentId - Reply comment ID
 * @returns {Promise<number>} Like count
 */
export const getReplyCommentLikeCount = async (replyCommentId) => {
  try {
    return await ReplyCommentLike.countDocuments({ replyCommentId });
  } catch (error) {
    logger.error("Error in getReplyCommentLikeCount:", error);
    return 0;
  }
};

/**
 * Check if a reply comment is liked by a user
 * @param {string} userId - User ID
 * @param {string} replyCommentId - Reply comment ID
 * @returns {Promise<boolean>} True if user has liked the reply comment
 */
export const isReplyCommentLikedByUser = async (userId, replyCommentId) => {
  try {
    const like = await ReplyCommentLike.findOne({
      replyCommentId,
      userId,
    });
    return !!like;
  } catch (error) {
    logger.error("Error in isReplyCommentLikedByUser:", error);
    return false;
  }
};

/**
 * Get like status and count for multiple reply comments
 * @param {string} userId - Current user ID (for isLiked)
 * @param {Array<string>} replyIds - Array of reply comment IDs
 * @returns {Promise<Object>} Object with replyId as key and { isLiked, likeCount } as value
 */
export const getRepliesLikeStatus = async (userId, replyIds) => {
  try {
    if (!replyIds || replyIds.length === 0) {
      return {};
    }

    const objectIds = replyIds.map((id) =>
      typeof id === "string" ? new mongoose.Types.ObjectId(id) : id
    );

    const [userLikes, likeCounts] = await Promise.all([
      ReplyCommentLike.find({
        replyCommentId: { $in: objectIds },
        userId,
      })
        .select("replyCommentId")
        .lean(),
      ReplyCommentLike.aggregate([
        { $match: { replyCommentId: { $in: objectIds } } },
        { $group: { _id: "$replyCommentId", count: { $sum: 1 } } },
      ]),
    ]);

    const likedSet = new Set(userLikes.map((l) => l.replyCommentId.toString()));
    const countMap = new Map();
    likeCounts.forEach((item) => {
      countMap.set(item._id.toString(), item.count);
    });

    const result = {};
    replyIds.forEach((replyId) => {
      const idStr = replyId.toString();
      result[idStr] = {
        isLiked: likedSet.has(idStr),
        likeCount: countMap.get(idStr) || 0,
      };
    });
    return result;
  } catch (error) {
    logger.error("Error in getRepliesLikeStatus:", error);
    return {};
  }
};

export default {
  toggleReplyCommentLike,
  getReplyCommentLikeCount,
  isReplyCommentLikedByUser,
  getRepliesLikeStatus,
};
