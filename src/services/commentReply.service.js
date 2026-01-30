/**
 * Comment Reply Service
 * Business logic for comment reply operations
 */

import ReplyComment from "../models/comments/ReplyComment.js";
import Comment from "../models/comments/Comment.js";
import { User } from "../models/index.js";
import { NotificationType } from "../models/enums.js";
import { parseAndValidateMentions } from "../utils/mentionParser.js";
import { getReplyCommentLikeCount, isReplyCommentLikedByUser } from "./replyCommentLike.service.js";
import { getTimeAgo, formatNumber } from "../utils/timeAgo.js";
import { createNotification } from "./notification.service.js";
import logger from "../utils/logger.js";

/**
 * Create a reply to a comment
 * @param {string} userId - User ID creating the reply
 * @param {string} commentId - Parent comment ID
 * @param {string} reply - Reply text
 * @returns {Promise<Object>} Created reply with populated user data
 */
export const createReply = async (userId, commentId, reply) => {
  try {
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Validate parent comment exists and is not deleted
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      throw new Error("Comment not found");
    }
    if (parentComment.isDeleted) {
      throw new Error("Cannot reply to a deleted comment");
    }

    // Validate reply text
    if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
      throw new Error("Reply text is required");
    }

    if (reply.trim().length > 1000) {
      throw new Error("Reply must be 1000 characters or less");
    }

    // Parse and validate mentions
    const { mentionedUserIds, invalidUsernames } = await parseAndValidateMentions(reply);

    // Log invalid mentions (but don't fail - just ignore them)
    if (invalidUsernames.length > 0) {
      logger.info(`Invalid mentions in reply by user ${userId}: ${invalidUsernames.join(", ")}`);
    }

    // Create reply
    const newReply = new ReplyComment({
      commentId,
      userId,
      reply: reply.trim(),
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [],
    });

    await newReply.save();

    // Populate user and mentioned users
    await newReply.populate([
      {
        path: "userId",
        select: "name username profileImage bio isVerifiedBadge",
      },
      {
        path: "mentionedUserIds",
        select: "name username profileImage bio isVerifiedBadge",
      },
    ]);

    // Get like count and user's like status
    const [likeCount, isLiked] = await Promise.all([
      getReplyCommentLikeCount(newReply._id),
      isReplyCommentLikedByUser(userId, newReply._id),
    ]);

    // Format like count and time ago
    const formattedLikeCount = formatNumber(likeCount);
    const timeAgo = getTimeAgo(newReply.createdAt);

    logger.info(`Reply created: ${newReply._id} by user ${userId} on comment ${commentId}`);

    // Create notifications
    try {
      const commentOwnerId = parentComment.userId;

      // Notify comment owner (if not self-reply)
      if (commentOwnerId.toString() !== userId.toString()) {
        await createNotification({
          receiverId: commentOwnerId,
          senderId: userId,
          type: NotificationType.COMMENT_REPLY,
          contentType: parentComment.contentType,
          contentId: parentComment.contentId,
          metadata: {
            commentId: parentComment._id.toString(),
            replyId: newReply._id.toString(),
          },
        });
      }

      // Notify mentioned users
      if (mentionedUserIds.length > 0) {
        const notificationPromises = mentionedUserIds.map((mentionedUserId) => {
          // Don't notify if mentioned user is the replier or comment owner
          if (
            mentionedUserId.toString() !== userId.toString() &&
            mentionedUserId.toString() !== commentOwnerId.toString()
          ) {
            return createNotification({
              receiverId: mentionedUserId,
              senderId: userId,
              type: NotificationType.MENTION_IN_COMMENT,
              contentType: parentComment.contentType,
              contentId: parentComment.contentId,
              metadata: {
                commentId: parentComment._id.toString(),
                replyId: newReply._id.toString(),
              },
            });
          }
          return Promise.resolve(null);
        });

        await Promise.all(notificationPromises);
      }
    } catch (notificationError) {
      // Log error but don't fail the reply creation
      logger.error("Error creating reply notifications:", notificationError);
    }

    // Format response
    return {
      id: newReply._id.toString(),
      commentId: commentId.toString(),
      reply: newReply.reply,
      user: {
        id: newReply.userId._id.toString(),
        name: newReply.userId.name,
        username: newReply.userId.username,
        profileImage: newReply.userId.profileImage,
        bio: newReply.userId.bio,
        isVerifiedBadge: newReply.userId.isVerifiedBadge,
      },
      mentionedUsers: newReply.mentionedUserIds.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio,
        isVerifiedBadge: user.isVerifiedBadge,
      })),
      likeCount,
      likeCountFormatted: formattedLikeCount, // Formatted with commas
      isLiked,
      timeAgo, // Relative time (e.g., "now", "30m", "11h")
      createdAt: newReply.createdAt,
      updatedAt: newReply.updatedAt,
    };
  } catch (error) {
    logger.error("Error in createReply:", error);
    throw error;
  }
};

/**
 * Get replies for a comment with pagination
 * @param {string} commentId - Parent comment ID
 * @param {string} currentUserId - Current user ID (for like status)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @returns {Promise<Object>} Replies with pagination
 */
export const getReplies = async (commentId, currentUserId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Validate parent comment exists
    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      throw new Error("Comment not found");
    }

    // Get replies (exclude deleted)
    const replies = await ReplyComment.find({
      commentId,
      isDeleted: false,
    })
      .populate("userId", "name username profileImage bio isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isVerifiedBadge")
      .sort({ createdAt: 1 }) // Oldest first for replies
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ReplyComment.countDocuments({
      commentId,
      isDeleted: false,
    });

    // Get like counts and status for all replies
    const replyIds = replies.map((r) => r._id.toString());
    const likeStatuses = await Promise.all(
      replyIds.map(async (replyId) => {
        const [likeCount, isLiked] = await Promise.all([
          getReplyCommentLikeCount(replyId),
          currentUserId ? isReplyCommentLikedByUser(currentUserId, replyId) : false,
        ]);
        return { replyId, likeCount, isLiked };
      })
    );

    const likeStatusMap = new Map();
    likeStatuses.forEach((status) => {
      likeStatusMap.set(status.replyId, { likeCount: status.likeCount, isLiked: status.isLiked });
    });

    // Format replies
    const formattedReplies = replies.map((reply) => {
      const replyId = reply._id.toString();
      const likeStatus = likeStatusMap.get(replyId) || { likeCount: 0, isLiked: false };

      // Format like count and time ago
      const formattedLikeCount = formatNumber(likeStatus.likeCount);
      const timeAgo = getTimeAgo(reply.createdAt);

      return {
        id: replyId,
        commentId: reply.commentId.toString(),
        reply: reply.reply,
        user: {
          id: reply.userId._id.toString(),
          name: reply.userId.name,
          username: reply.userId.username,
          profileImage: reply.userId.profileImage,
          bio: reply.userId.bio,
          isVerifiedBadge: reply.userId.isVerifiedBadge,
        },
        mentionedUsers: reply.mentionedUserIds.map((user) => ({
          id: user._id.toString(),
          name: user.name,
          username: user.username,
          profileImage: user.profileImage,
          bio: user.bio,
          isVerifiedBadge: user.isVerifiedBadge,
        })),
        likeCount: likeStatus.likeCount,
        likeCountFormatted: formattedLikeCount, // Formatted with commas
        isLiked: likeStatus.isLiked,
        timeAgo, // Relative time (e.g., "now", "30m", "11h")
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      };
    });

    return {
      replies: formattedReplies,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error in getReplies:", error);
    throw error;
  }
};

export default {
  createReply,
  getReplies,
};
