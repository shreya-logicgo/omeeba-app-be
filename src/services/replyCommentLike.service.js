/**
 * Reply Comment Like Service
 * Business logic for reply comment like operations
 */

import ReplyCommentLike from "../models/comments/ReplyCommentLike.js";
import logger from "../utils/logger.js";

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

export default {
  getReplyCommentLikeCount,
  isReplyCommentLikedByUser,
};
