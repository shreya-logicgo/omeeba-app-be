/**
 * Comment Service
 * Business logic for comment operations
 */

import Comment from "../models/comments/Comment.js";
import { User } from "../models/index.js";
import { ContentType, ContentTypeToModelName } from "../models/enums.js";
import { getContentModel, validateContentExists } from "../models/utils/contentHelper.js";
import { parseAndValidateMentions } from "../utils/mentionParser.js";
import { getCommentLikeCount, isCommentLikedByUser, getCommentsLikeStatus } from "./commentLike.service.js";
import { getTimeAgo, formatNumber } from "../utils/timeAgo.js";
import logger from "../utils/logger.js";

/**
 * Create a comment on content
 * @param {string} userId - User ID creating the comment
 * @param {Object} commentData - Comment data (contentType, contentId, comment)
 * @returns {Promise<Object>} Created comment with populated user data
 */
export const createComment = async (userId, commentData) => {
  try {
    const { contentType, contentId, comment } = commentData;

    // Validate user exists and is not deleted
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      throw new Error("Invalid content type");
    }

    // Validate content exists
    const contentExists = await validateContentExists(contentType, contentId);
    if (!contentExists) {
      throw new Error("Content not found");
    }

    // Validate comment text
    if (!comment || typeof comment !== "string" || comment.trim().length === 0) {
      throw new Error("Comment text is required");
    }

    if (comment.trim().length > 1000) {
      throw new Error("Comment must be 1000 characters or less");
    }

    // Parse and validate mentions
    const { mentionedUserIds, invalidUsernames } = await parseAndValidateMentions(comment);

    // Log invalid mentions (but don't fail - just ignore them)
    if (invalidUsernames.length > 0) {
      logger.info(`Invalid mentions in comment by user ${userId}: ${invalidUsernames.join(", ")}`);
    }

    // Get contentTypeRef from ContentTypeToModelName mapping
    const contentTypeRef = ContentTypeToModelName[contentType];
    if (!contentTypeRef) {
      throw new Error("Invalid content type - unable to determine model reference");
    }

    // Create comment
    const newComment = new Comment({
      contentType,
      contentId,
      contentTypeRef, // Set explicitly before save
      userId,
      comment: comment.trim(),
      mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : [],
    });

    await newComment.save();

    // Populate user and mentioned users
    await newComment.populate([
      {
        path: "userId",
        select: "name username profileImage bio isVerifiedBadge",
      },
      {
        path: "mentionedUserIds",
        select: "name username profileImage bio isVerifiedBadge",
      },
    ]);

    logger.info(`Comment created: ${newComment._id} by user ${userId} on ${contentType} ${contentId}`);

    // Get like count and user's like status
    const [likeCount, isLiked] = await Promise.all([
      getCommentLikeCount(newComment._id),
      isCommentLikedByUser(userId, newComment._id),
    ]);

    // Format like count and time ago
    const formattedLikeCount = formatNumber(likeCount);
    const timeAgo = getTimeAgo(newComment.createdAt);

    // Format response
    return {
      id: newComment._id.toString(),
      contentType: newComment.contentType,
      contentId: newComment.contentId.toString(),
      comment: newComment.comment,
      user: {
        id: newComment.userId._id.toString(),
        name: newComment.userId.name,
        username: newComment.userId.username,
        profileImage: newComment.userId.profileImage,
        bio: newComment.userId.bio,
        isVerifiedBadge: newComment.userId.isVerifiedBadge,
      },
      mentionedUsers: newComment.mentionedUserIds.map((user) => ({
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
      replyCount: 0, // New comment has no replies yet
      timeAgo, // Relative time (e.g., "now", "30m", "11h")
      createdAt: newComment.createdAt,
      updatedAt: newComment.updatedAt,
    };
  } catch (error) {
    logger.error("Error in createComment:", error);
    throw error;
  }
};

export default {
  createComment,
};
