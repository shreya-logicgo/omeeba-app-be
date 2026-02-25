/**
 * Comment Listing Service
 * Business logic for fetching comments with visibility rules
 */

import Comment from "../models/comments/Comment.js";
import ReplyComment from "../models/comments/ReplyComment.js";
import { User } from "../models/index.js";
import { ContentType } from "../models/enums.js";
import { validateContentExists } from "../models/utils/contentHelper.js";
import { getCommentLikeCount, getCommentsLikeStatus, isCommentLikedByUser } from "./commentLike.service.js";
import { getRepliesLikeStatus } from "./replyCommentLike.service.js";
import { getReportedCommentIdsSet } from "../utils/commentFilter.js";
import { getTimeAgo, formatNumber } from "../utils/timeAgo.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";

/**
 * Get comments for content with pagination and visibility rules
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
 * @param {string} contentId - Content ID
 * @param {string} currentUserId - Current user ID (for visibility rules)
 * @param {number} page - Page number (default: 1)
 * @param {number} limit - Items per page (default: 20)
 * @returns {Promise<Object>} Comments with pagination
 */
export const getComments = async (contentType, contentId, currentUserId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      throw new Error("Invalid content type");
    }

    // Validate content exists
    const contentExists = await validateContentExists(contentType, contentId);
    if (!contentExists) {
      throw new Error("Content not found");
    }

    // Query: only non-deleted comments
    const query = {
      contentType,
      contentId,
      isDeleted: false,
    };

    // Fetch comments
    const comments = await Comment.find(query)
      .populate("userId", "name username profileImage bio isDeleted isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isDeleted isVerifiedBadge")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Filter out comments whose users are deleted
    const visibleComments = comments.filter(c => !c.userId?.isDeleted);

    const total = await Comment.countDocuments(query);

    // Get reported comment IDs for current user
    let reportedCommentIds = new Set();
    if (currentUserId && visibleComments.length > 0) {
      const commentIds = visibleComments.map(c => c._id.toString());
      reportedCommentIds = await getReportedCommentIdsSet(currentUserId, commentIds);
    }

    // Filter reported comments
    const finalComments = visibleComments.filter(c => !reportedCommentIds.has(c._id.toString()));

    const commentIds = finalComments.map(c => c._id.toString());

    // Get like statuses
    let likeStatuses = {};
    if (currentUserId && commentIds.length > 0) {
      likeStatuses = await getCommentsLikeStatus(currentUserId, commentIds);
    }

    // Get reply counts
    const replyCounts = await Promise.all(
      commentIds.map(async (commentId) => {
        const count = await ReplyComment.countDocuments({ commentId, isDeleted: false });
        return { commentId, replyCount: count };
      })
    );
    const replyCountMap = new Map();
    replyCounts.forEach(item => replyCountMap.set(item.commentId, item.replyCount));

    // Fetch replies (first 20 per comment)
    const repliesPerCommentLimit = 20;
    const allReplies = await ReplyComment.find({ commentId: { $in: commentIds }, isDeleted: false })
      .populate("userId", "name username profileImage bio isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isVerifiedBadge")
      .sort({ createdAt: 1 })
      .lean();

    const repliesByCommentId = new Map();
    for (const reply of allReplies) {
      const cid = reply.commentId.toString();
      if (!repliesByCommentId.has(cid)) repliesByCommentId.set(cid, []);
      const arr = repliesByCommentId.get(cid);
      if (arr.length < repliesPerCommentLimit) arr.push(reply);
    }

    const allReplyIds = allReplies.map(r => r._id.toString());
    const replyLikeStatuses = await getRepliesLikeStatus(currentUserId || null, allReplyIds);

    const formatReply = (reply) => {
      const replyId = reply._id.toString();
      const likeStatus = replyLikeStatuses[replyId] || { likeCount: 0, isLiked: false };
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
        mentionedUsers: (reply.mentionedUserIds || []).filter(u => !u.isDeleted).map(u => ({
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
    };

    const formattedComments = finalComments.map(comment => {
      const commentId = comment._id.toString();
      const likeStatus = likeStatuses[commentId] || { likeCount: 0, isLiked: false };
      const replyCount = replyCountMap.get(commentId) || 0;
      const commentReplies = (repliesByCommentId.get(commentId) || []).map(formatReply);

      return {
        id: commentId,
        contentType: comment.contentType,
        contentId: comment.contentId.toString(),
        comment: comment.comment,
        user: {
          id: comment.userId._id.toString(),
          name: comment.userId.name,
          username: comment.userId.username,
          profileImage: comment.userId.profileImage,
          bio: comment.userId.bio,
          isVerifiedBadge: comment.userId.isVerifiedBadge,
        },
        mentionedUsers: comment.mentionedUserIds.filter(u => !u.isDeleted).map(u => ({
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
        replyCount,
        replies: commentReplies,
        timeAgo: getTimeAgo(comment.createdAt),
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      };
    });

    return {
      comments: formattedComments,
      pagination: getPaginationMeta(finalComments.length, page, limit),
    };
  } catch (error) {
    logger.error("Error in getComments:", error);
    throw error;
  }
};
/**
 * Get a single comment by ID with visibility rules
 * @param {string} commentId - Comment ID
 * @param {string} currentUserId - Current user ID (for visibility rules)
 * @returns {Promise<Object|null>} Comment or null if not visible
 */
export const getCommentById = async (commentId, currentUserId) => {
  try {
    // Find comment
    const comment = await Comment.findById(commentId)
      .populate("userId", "name username profileImage bio isDeleted isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isDeleted isVerifiedBadge")
      .lean();

    if (!comment) return null;

    // Exclude deleted comment or comment from deleted user
    if (comment.isDeleted || comment.userId?.isDeleted) return null;

    // Check if reported by current user
    if (currentUserId) {
      const { isCommentReportedByUser } = await import("../utils/commentFilter.js");
      const isReported = await isCommentReportedByUser(currentUserId, commentId);
      if (isReported) return null;
    }

    // Get like count and status
    const [likeCount, isLiked] = await Promise.all([
      getCommentLikeCount(commentId),
      currentUserId ? isCommentLikedByUser(currentUserId, commentId) : false,
    ]);

    // Get replies (only non-deleted and non-deleted users)
    const repliesRaw = await ReplyComment.find({ commentId, isDeleted: false })
      .populate("userId", "name username profileImage bio isDeleted isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isDeleted isVerifiedBadge")
      .sort({ createdAt: 1 })
      .limit(20)
      .lean();

    // Filter out replies from deleted users
    const filteredReplies = repliesRaw.filter(r => !r.userId?.isDeleted);

    const replyIds = filteredReplies.map(r => r._id.toString());
    const replyLikeStatuses = await getRepliesLikeStatus(currentUserId || null, replyIds);

    const formatReply = (reply) => {
      const replyId = reply._id.toString();
      const likeStatus = replyLikeStatuses[replyId] || { likeCount: 0, isLiked: false };
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
        mentionedUsers: (reply.mentionedUserIds || [])
          .filter(u => !u.isDeleted)
          .map(u => ({
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
    };

    const replies = filteredReplies.map(formatReply);

    return {
      id: comment._id.toString(),
      contentType: comment.contentType,
      contentId: comment.contentId.toString(),
      comment: comment.comment,
      user: {
        id: comment.userId._id.toString(),
        name: comment.userId.name,
        username: comment.userId.username,
        profileImage: comment.userId.profileImage,
        bio: comment.userId.bio,
        isVerifiedBadge: comment.userId.isVerifiedBadge,
      },
      mentionedUsers: comment.mentionedUserIds
        .filter(u => !u.isDeleted)
        .map(u => ({
          id: u._id.toString(),
          name: u.name,
          username: u.username,
          profileImage: u.profileImage,
          bio: u.bio,
          isVerifiedBadge: u.isVerifiedBadge,
        })),
      likeCount,
      likeCountFormatted: formatNumber(likeCount),
      isLiked,
      replyCount: replies.length,
      replies,
      timeAgo: getTimeAgo(comment.createdAt),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  } catch (error) {
    logger.error("Error in getCommentById:", error);
    throw error;
  }
};

export default {
  getComments,
  getCommentById,
};
