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
import { getPaginationMeta } from "../utils/pagination.js";
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
            replyText: newReply.reply,
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
                replyText: newReply.reply,
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

    // Get only top-level replies (no parentReplyId or parentReplyId is null)
    const replies = await ReplyComment.find({
      commentId,
      $or: [{ parentReplyId: null }, { parentReplyId: { $exists: false } }],
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
      $or: [{ parentReplyId: null }, { parentReplyId: { $exists: false } }],
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
        parentReplyId: reply.parentReplyId ? reply.parentReplyId.toString() : null,
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
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getReplies:", error);
    throw error;
  }
};

/**
 * Delete a reply (soft delete) - only the reply owner can delete
 * @param {string} userId - User ID deleting the reply
 * @param {string} replyId - Reply ID to delete
 * @returns {Promise<Object>} Success with replyId and message
 */
export const deleteReply = async (userId, replyId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.isDeleted) throw new Error("User account has been deleted");

    const reply = await ReplyComment.findById(replyId);
    if (!reply) throw new Error("Reply not found");
    if (reply.isDeleted) throw new Error("Reply is already deleted");

    if (reply.userId.toString() !== userId) {
      throw new Error("You can only delete your own replies");
    }

    reply.isDeleted = true;
    reply.deletedAt = new Date();
    await reply.save();

    logger.info(`Reply ${replyId} soft deleted by user ${userId}`);

    return {
      replyId: reply._id.toString(),
      message: "Reply deleted successfully",
    };
  } catch (error) {
    logger.error("Error in deleteReply:", error);
    throw error;
  }
};

/**
 * Create a reply to a reply (nested reply)
 * @param {string} userId - User ID creating the reply
 * @param {string} parentReplyId - Parent reply ID to reply to
 * @param {string} reply - Reply text
 * @returns {Promise<Object>} Created reply with populated user data
 */
export const createReplyToReply = async (userId, parentReplyId, reply) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    if (user.isDeleted) throw new Error("User account has been deleted");

    const parentReply = await ReplyComment.findById(parentReplyId)
      .populate("userId", "_id")
      .lean();
    if (!parentReply) throw new Error("Reply not found");
    if (parentReply.isDeleted) throw new Error("Cannot reply to a deleted reply");

    if (!reply || typeof reply !== "string" || reply.trim().length === 0) {
      throw new Error("Reply text is required");
    }
    if (reply.trim().length > 1000) throw new Error("Reply must be 1000 characters or less");

    const { mentionedUserIds, invalidUsernames } = await parseAndValidateMentions(reply);
    if (invalidUsernames.length > 0) {
      logger.info(`Invalid mentions in reply-to-reply by user ${userId}: ${invalidUsernames.join(", ")}`);
    }

    const newReply = new ReplyComment({
      commentId: parentReply.commentId,
      parentReplyId: parentReply._id,
      userId,
      reply: reply.trim(),
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [],
    });
    await newReply.save();

    await newReply.populate([
      { path: "userId", select: "name username profileImage bio isVerifiedBadge" },
      { path: "mentionedUserIds", select: "name username profileImage bio isVerifiedBadge" },
    ]);

    const [likeCount, isLiked] = await Promise.all([
      getReplyCommentLikeCount(newReply._id),
      isReplyCommentLikedByUser(userId, newReply._id),
    ]);
    const formattedLikeCount = formatNumber(likeCount);
    const timeAgo = getTimeAgo(newReply.createdAt);

    logger.info(`Reply-to-reply created: ${newReply._id} by user ${userId} on reply ${parentReplyId}`);

    try {
      const parentReplyUserId = parentReply.userId?._id || parentReply.userId;
      if (parentReplyUserId && parentReplyUserId.toString() !== userId.toString()) {
        const parentComment = await Comment.findById(parentReply.commentId).lean();
        if (parentComment) {
          await createNotification({
            receiverId: parentReplyUserId,
            senderId: userId,
            type: NotificationType.COMMENT_REPLY,
            contentType: parentComment.contentType,
            contentId: parentComment.contentId,
            metadata: {
              commentId: parentReply.commentId.toString(),
              replyId: newReply._id.toString(),
              parentReplyId: parentReplyId.toString(),
              replyText: newReply.reply,
            },
          });
        }
      }
      if (mentionedUserIds.length > 0) {
        const parentComment = await Comment.findById(parentReply.commentId).lean();
        for (const mentionedUserId of mentionedUserIds) {
          if (
            mentionedUserId.toString() !== userId.toString() &&
            mentionedUserId.toString() !== (parentReply.userId?._id || parentReply.userId)?.toString()
          ) {
            await createNotification({
              receiverId: mentionedUserId,
              senderId: userId,
              type: NotificationType.MENTION_IN_COMMENT,
              contentType: parentComment?.contentType,
              contentId: parentComment?.contentId,
              metadata: {
                commentId: parentReply.commentId.toString(),
                replyId: newReply._id.toString(),
                parentReplyId: parentReplyId.toString(),
                replyText: newReply.reply,
              },
            });
          }
        }
      }
    } catch (notificationError) {
      logger.error("Error creating reply-to-reply notifications:", notificationError);
    }

    return {
      id: newReply._id.toString(),
      commentId: newReply.commentId.toString(),
      parentReplyId: parentReplyId.toString(),
      reply: newReply.reply,
      user: {
        id: newReply.userId._id.toString(),
        name: newReply.userId.name,
        username: newReply.userId.username,
        profileImage: newReply.userId.profileImage,
        bio: newReply.userId.bio,
        isVerifiedBadge: newReply.userId.isVerifiedBadge,
      },
      mentionedUsers: (newReply.mentionedUserIds || []).map((u) => ({
        id: u._id.toString(),
        name: u.name,
        username: u.username,
        profileImage: u.profileImage,
        bio: u.bio,
        isVerifiedBadge: u.isVerifiedBadge,
      })),
      likeCount,
      likeCountFormatted: formattedLikeCount,
      isLiked,
      timeAgo,
      createdAt: newReply.createdAt,
      updatedAt: newReply.updatedAt,
    };
  } catch (error) {
    logger.error("Error in createReplyToReply:", error);
    throw error;
  }
};

/**
 * Get replies to a reply (nested replies) with pagination
 * @param {string} parentReplyId - Parent reply ID
 * @param {string} currentUserId - Current user ID (for like status)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @returns {Promise<Object>} Replies with pagination
 */
export const getRepliesToReply = async (parentReplyId, currentUserId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    const parentReply = await ReplyComment.findById(parentReplyId).lean();
    if (!parentReply) throw new Error("Reply not found");

    const replies = await ReplyComment.find({
      parentReplyId,
      isDeleted: false,
    })
      .populate("userId", "name username profileImage bio isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isVerifiedBadge")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ReplyComment.countDocuments({
      parentReplyId,
      isDeleted: false,
    });

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
    likeStatuses.forEach((s) => likeStatusMap.set(s.replyId, { likeCount: s.likeCount, isLiked: s.isLiked }));

    const formattedReplies = replies.map((reply) => {
      const replyId = reply._id.toString();
      const likeStatus = likeStatusMap.get(replyId) || { likeCount: 0, isLiked: false };
      return {
        id: replyId,
        commentId: reply.commentId.toString(),
        parentReplyId: reply.parentReplyId?.toString() || null,
        reply: reply.reply,
        user: {
          id: reply.userId._id.toString(),
          name: reply.userId.name,
          username: reply.userId.username,
          profileImage: reply.userId.profileImage,
          bio: reply.userId.bio,
          isVerifiedBadge: reply.userId.isVerifiedBadge,
        },
        mentionedUsers: (reply.mentionedUserIds || []).map((u) => ({
          id: u._id.toString(),
          name: u.name,
          username: u.username,
          profileImage: u.profileImage,
          bio: u.bio,
          isVerifiedBadge: u.isVerifiedBadge,
        })),
        likeCount: likeStatus.likeCount,
        likeCountFormatted: formatNumber(likeStatus.likeCount),
        isLiked: likeStatus.isLiked,
        timeAgo: getTimeAgo(reply.createdAt),
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt,
      };
    });

    return {
      replies: formattedReplies,
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getRepliesToReply:", error);
    throw error;
  }
};

export default {
  createReply,
  getReplies,
  createReplyToReply,
  getRepliesToReply,
};
