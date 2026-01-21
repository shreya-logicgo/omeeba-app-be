/**
 * Comment Deletion Service
 * Business logic for comment deletion (soft delete)
 */

import Comment from "../models/comments/Comment.js";
import { User } from "../models/index.js";
import logger from "../utils/logger.js";

/**
 * Delete a comment (soft delete)
 * @param {string} userId - User ID deleting the comment
 * @param {string} commentId - Comment ID to delete
 * @returns {Promise<Object>} Success message
 */
export const deleteComment = async (userId, commentId) => {
  try {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Find comment
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Check if comment is already deleted
    if (comment.isDeleted) {
      throw new Error("Comment is already deleted");
    }

    // Check if user owns the comment
    if (comment.userId.toString() !== userId) {
      throw new Error("You can only delete your own comments");
    }

    // Soft delete: Set isDeleted to true and deletedAt timestamp
    comment.isDeleted = true;
    comment.deletedAt = new Date();
    await comment.save();

    logger.info(`Comment ${commentId} soft deleted by user ${userId}`);

    return {
      commentId: commentId.toString(),
      message: "Comment deleted successfully",
    };
  } catch (error) {
    logger.error("Error in deleteComment:", error);
    throw error;
  }
};

export default {
  deleteComment,
};
