/**
 * Comment Like Service
 * Business logic for comment like operations
 */

import mongoose from "mongoose";
import CommentLike from "../models/comments/CommentLike.js";
import Comment from "../models/comments/Comment.js";
import { User } from "../models/index.js";
import { formatNumber } from "../utils/timeAgo.js";
import logger from "../utils/logger.js";

/**
 * Toggle like on a comment (like if not liked, unlike if already liked)
 * @param {string} userId - User ID liking/unliking the comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<Object>} Like status and count
 */
export const toggleCommentLike = async (userId, commentId) => {
  try {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Validate comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Check if user has already liked this comment
    const existingLike = await CommentLike.findOne({
      commentId,
      userId,
    });

    let isLiked;
    let likeCount;

    if (existingLike) {
      // Unlike: Remove the like
      await CommentLike.findByIdAndDelete(existingLike._id);
      isLiked = false;
      
      // Get updated like count
      likeCount = await CommentLike.countDocuments({ commentId });
      
      logger.info(`Comment ${commentId} unliked by user ${userId}`);
    } else {
      // Like: Create new like
      await CommentLike.create({
        commentId,
        userId,
      });
      isLiked = true;
      
      // Get updated like count
      likeCount = await CommentLike.countDocuments({ commentId });
      
      logger.info(`Comment ${commentId} liked by user ${userId}`);
    }

    // Format like count with commas
    const formattedLikeCount = formatNumber(likeCount);

    return {
      commentId: commentId.toString(),
      isLiked,
      likeCount,
      likeCountFormatted: formattedLikeCount, // Formatted with commas (e.g., "1,579")
    };
  } catch (error) {
    // Handle duplicate key error (shouldn't happen due to unique index, but just in case)
    if (error.code === 11000) {
      throw new Error("You have already liked this comment");
    }
    
    logger.error("Error in toggleCommentLike:", error);
    throw error;
  }
};

/**
 * Get like status for a comment by a user
 * @param {string} userId - User ID
 * @param {string} commentId - Comment ID
 * @returns {Promise<boolean>} True if user has liked the comment
 */
export const isCommentLikedByUser = async (userId, commentId) => {
  try {
    const like = await CommentLike.findOne({
      commentId,
      userId,
    });
    return !!like;
  } catch (error) {
    logger.error("Error in isCommentLikedByUser:", error);
    return false;
  }
};

/**
 * Get like count for a comment
 * @param {string} commentId - Comment ID
 * @returns {Promise<number>} Like count
 */
export const getCommentLikeCount = async (commentId) => {
  try {
    return await CommentLike.countDocuments({ commentId });
  } catch (error) {
    logger.error("Error in getCommentLikeCount:", error);
    return 0;
  }
};

/**
 * Get like status and count for multiple comments
 * @param {string} userId - User ID
 * @param {Array<string>} commentIds - Array of comment IDs
 * @returns {Promise<Object>} Object with commentId as key and {isLiked, likeCount} as value
 */
export const getCommentsLikeStatus = async (userId, commentIds) => {
  try {
    if (!commentIds || commentIds.length === 0) {
      return {};
    }

    // Get all likes by this user for these comments
    const userLikes = await CommentLike.find({
      commentId: { $in: commentIds },
      userId,
    }).select("commentId")
      .lean();

    // Create a Set of liked comment IDs for quick lookup
    const likedCommentIds = new Set(
      userLikes.map((like) => like.commentId.toString())
    );

    // Convert commentIds to ObjectIds if they're strings
    const objectIds = commentIds.map((id) => {
      if (typeof id === "string") {
        return new mongoose.Types.ObjectId(id);
      }
      return id;
    });

    // Get like counts for all comments
    const likeCounts = await CommentLike.aggregate([
      {
        $match: {
          commentId: { $in: objectIds },
        },
      },
      {
        $group: {
          _id: "$commentId",
          count: { $sum: 1 },
        },
      },
    ]);

    // Create a map of commentId to like count
    const likeCountMap = new Map();
    likeCounts.forEach((item) => {
      likeCountMap.set(item._id.toString(), item.count);
    });

    // Build result object
    const result = {};
    commentIds.forEach((commentId) => {
      const idStr = commentId.toString();
      result[idStr] = {
        isLiked: likedCommentIds.has(idStr),
        likeCount: likeCountMap.get(idStr) || 0,
      };
    });

    return result;
  } catch (error) {
    logger.error("Error in getCommentsLikeStatus:", error);
    return {};
  }
};

export default {
  toggleCommentLike,
  isCommentLikedByUser,
  getCommentLikeCount,
  getCommentsLikeStatus,
};
