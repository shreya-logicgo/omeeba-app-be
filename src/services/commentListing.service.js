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
import { getReportedCommentIdsSet } from "../utils/commentFilter.js";
import { getTimeAgo, formatNumber } from "../utils/timeAgo.js";
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

    // Build query - include deleted comments (we'll show them with "deleted" message)
    const query = {
      contentType,
      contentId,
    };

    // Get reported comment IDs for current user (to exclude them)
    let reportedCommentIds = new Set();
    if (currentUserId) {
      // We'll filter after fetching to avoid complex queries
      // For now, fetch all and filter
    }

    // Fetch comments (newest first)
    const comments = await Comment.find(query)
      .populate("userId", "name username profileImage bio isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isVerifiedBadge")
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Comment.countDocuments(query);

    // Get reported comment IDs for current user
    if (currentUserId && comments.length > 0) {
      const commentIds = comments.map((c) => c._id.toString());
      reportedCommentIds = await getReportedCommentIdsSet(currentUserId, commentIds);
    }

    // Filter out reported comments for current user, but keep deleted comments
    const visibleComments = comments.filter((comment) => {
      if (currentUserId && reportedCommentIds.has(comment._id.toString())) {
        return false; // Hide reported comments
      }
      return true; // Include deleted comments (will show "deleted" message)
    });

    // Get comment IDs for like status and reply counts
    const commentIds = visibleComments.map((c) => c._id.toString());

    // Get like statuses for all comments
    let likeStatuses = {};
    if (currentUserId && commentIds.length > 0) {
      likeStatuses = await getCommentsLikeStatus(currentUserId, commentIds);
    }

    // Get reply counts for all comments (in parallel)
    const replyCounts = await Promise.all(
      commentIds.map(async (commentId) => {
        // Get total reply count (quick count, no pagination needed)
        const count = await ReplyComment.countDocuments({
          commentId,
          isDeleted: false,
        });
        return { commentId, replyCount: count };
      })
    );

    const replyCountMap = new Map();
    replyCounts.forEach((item) => {
      replyCountMap.set(item.commentId, item.replyCount);
    });

    // Format comments
    const formattedComments = visibleComments.map((comment) => {
      const commentId = comment._id.toString();
      const isDeleted = comment.isDeleted || false;
      const likeStatus = likeStatuses[commentId] || { likeCount: 0, isLiked: false };
      const replyCount = replyCountMap.get(commentId) || 0;

      // Format like count with commas
      const formattedLikeCount = formatNumber(likeStatus.likeCount);
      const timeAgo = getTimeAgo(comment.createdAt);

      // If deleted, return minimal info with deleted message
      if (isDeleted) {
        return {
          id: commentId,
          contentType: comment.contentType,
          contentId: comment.contentId.toString(),
          isDeleted: true,
          message: "This comment was deleted",
          replyCount, // Replies remain visible
          timeAgo,
          createdAt: comment.createdAt,
          deletedAt: comment.deletedAt,
        };
      }

      // Normal comment
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
        mentionedUsers: comment.mentionedUserIds.map((user) => ({
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
        replyCount,
        timeAgo, // Relative time (e.g., "30m", "11h", "20h")
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      };
    });

    return {
      comments: formattedComments,
      pagination: {
        page,
        limit,
        total: visibleComments.length, // Adjusted total after filtering
        totalPages: Math.ceil(total / limit), // Use original total for pagination
      },
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
      .populate("userId", "name username profileImage bio isVerifiedBadge")
      .populate("mentionedUserIds", "name username profileImage bio isVerifiedBadge")
      .lean();

    if (!comment) {
      return null;
    }

    // Check if deleted
    if (comment.isDeleted) {
      return {
        id: comment._id.toString(),
        isDeleted: true,
        message: "This comment was deleted",
        createdAt: comment.createdAt,
      };
    }

    // Check if reported by current user
    if (currentUserId) {
      const { isCommentReportedByUser } = await import("../utils/commentFilter.js");
      const isReported = await isCommentReportedByUser(currentUserId, commentId);
      if (isReported) {
        return null; // Hide reported comment
      }
    }

    // Get like count and status
    const [likeCount, isLiked] = await Promise.all([
      getCommentLikeCount(commentId),
      currentUserId ? isCommentLikedByUser(currentUserId, commentId) : false,
    ]);

    // Get reply count
    const replyCount = await ReplyComment.countDocuments({
      commentId,
      isDeleted: false,
    });

    // Format like count and time ago
    const formattedLikeCount = formatNumber(likeCount);
    const timeAgo = getTimeAgo(comment.createdAt);

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
      mentionedUsers: comment.mentionedUserIds.map((user) => ({
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
      replyCount,
      timeAgo, // Relative time (e.g., "30m", "11h", "20h")
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
