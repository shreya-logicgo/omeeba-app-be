import { getContentModel } from "../utils/contentModel.js";
import logger from "../utils/logger.js";
import { ContentType } from "../models/enums.js";
import ContentLike from "../models/interactions/ContentLike.js";
import Comment from "../models/comments/Comment.js";
import ContentShare from "../models/interactions/ContentShare.js";

import {getIsFollowing} from "../utils/followUtils.js";
import { UserFollower } from "../models/index.js";
import mongoose from "mongoose";

/**
 * Helper: Apply conditional population safely
 */
const applyPopulation = (query, contentType) => {
  const ownerField =
    contentType === ContentType.POLL ? "createdBy" : "userId";

  // Populate owner
  query = query.populate({
    path: ownerField,
    select:
      "name username profileImage isAccountVerified isVerifiedBadge",
  });

  // POST, ZEAL, WRITE_POST → mentioned users
  if (
    contentType === ContentType.POST ||
    contentType === ContentType.ZEAL ||
    contentType === ContentType.WRITE_POST
  ) {
    query = query.populate({
      path: "mentionedUserIds",
      select:
        "name username profileImage isAccountVerified isVerifiedBadge",
    });
  }

  // Only POST & ZEAL → music
  if (
    contentType === ContentType.POST ||
    contentType === ContentType.ZEAL
  ) {
    query = query.populate({
      path: "musicId",
      select: "title artist album coverImage duration",
    });
  }

  return query;
};

/**
 * Helper: format content item JSON for all content types
 */
const formatContent = (
  item,
  contentType,
  metrics = {},
  isLiked = false,
  isSaved = false
) => {
  const user = item.userId || item.createdBy;

  const baseItem = {
    id: item._id.toString(),
    contentType,
    userId: user
      ? {
          id: user._id?.toString(),
          name: user.name,
          username: user.username,
          profileImage: user.profileImage,
          isAccountVerified: user.isAccountVerified,
          isVerifiedBadge: user.isVerifiedBadge,
        }
      : null,

    mentionedUsers: (item.mentionedUserIds || []).map((u) => ({
      id: u._id?.toString(),
      name: u.name,
      username: u.username,
      profileImage: u.profileImage,
      isAccountVerified: u.isAccountVerified,
      isVerifiedBadge: u.isVerifiedBadge,
    })),

    likeCount: Number(metrics.likeCount ?? 0),
    commentCount: Number(metrics.commentCount ?? 0),
    shareCount: Number(metrics.shareCount ?? 0),

    isLiked,
    isSaved,

    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  const music =
    item.musicId && item.musicId._id
      ? {
          id: item.musicId._id.toString(),
          title: item.musicId.title,
          artist: item.musicId.artist,
          album: item.musicId.album,
          coverImage: item.musicId.coverImage,
          duration: item.musicId.duration,
        }
      : null;

  switch (contentType) {
    case ContentType.POST:
      return {
        ...baseItem,
        caption: item.caption || "",
        images: item.images || [],
        music,
        musicStartTime: item.musicStartTime,
        musicEndTime: item.musicEndTime,
      };

    case ContentType.WRITE_POST:
      return {
        ...baseItem,
        content: item.content,
      };

    case ContentType.ZEAL:
      return {
        ...baseItem,
        caption: item.caption || "",
        videos: item.videos || [],
        images: item.images || [],
        music,
        musicStartTime: item.musicStartTime,
        musicEndTime: item.musicEndTime,
        isDevelopByAi: item.isDevelopByAi || false,
        status: item.status,
        mediaUrl: item.mediaUrl,
        thumbnailUrl: item.thumbnailUrl,
      };

    case ContentType.POLL:
      return {
        ...baseItem,
        caption: item.caption || "",
        options: item.options || [],
        totalVotes: Number(item.totalVotes ?? 0),
        userVotes: item.userVotes || [],
        status: item.status,
        duration: item.duration,
      };

    default:
      return baseItem;
  }
};

/**
 * Get single content
 */
export const getSingleContent = async (contentType, contentId, currentUserId = null) => {
  try {
    const Model = getContentModel(contentType);

    // Fetch the content with population
    let query = Model.findById(contentId);
    query = applyPopulation(query, contentType);

    const content = await query;
    if (!content) throw new Error(`${contentType} not found`);

    const contentIdObj = new mongoose.Types.ObjectId(contentId);

    // Metrics: likeCount, commentCount, shareCount (same as feed APIs)
    const [likeCount, commentCount, shareCount] = await Promise.all([
      ContentLike.countDocuments({ contentType, contentId: contentIdObj }),
      Comment.countDocuments({ contentType, contentId: contentIdObj, isDeleted: false }),
      ContentShare.countDocuments({ contentType, contentId: contentIdObj }),
    ]);

    // Check if current user liked
    let isLiked = false;
    if (currentUserId) {
      const existingLike = await ContentLike.findOne({
        contentType,
        contentId: contentIdObj,
        userId: currentUserId,
      });
      isLiked = !!existingLike;
    }

    // Format content normally (includes likeCount, commentCount, shareCount)
    const formatted = formatContent(
      content,
      contentType,
      { likeCount, commentCount, shareCount },
      isLiked,
      false // isSaved
    );

    if (contentType === ContentType.POLL && content) {
      const userVotes = content.userVotes || [];
      const getVoteUserIdStr = (v) => {
        const u = v.userId;
        if (!u) return null;
        if (u._id != null) return String(u._id);
        return String(u);
      };
      const userVote = userVotes.find(
        (v) => getVoteUserIdStr(v) === currentUserId
      );
      const userSelectedOptionId = userVote ? userVote.optionId : null;
      // Same option shape as GET /polls/:pollId
      formatted.options = (formatted.options || []).map((option) => ({
        optionId: option.optionId,
        optionText: option.optionText,
        voteCount: option.voteCount,
        votePercentage: option.votePercentage,
        selectedByAuthUser:
          userSelectedOptionId != null &&
          option.optionId === userSelectedOptionId,
      }));
    }

    // --- Add isFollowing dynamically ---
    if (currentUserId) {
      const followRows = await UserFollower.find({ followerId: currentUserId })
        .select("userId")
        .lean();
      const followedUserIdSet = new Set(followRows.map(f => f.userId?.toString()));

      formatted.isFollowing = getIsFollowing(content, currentUserId, followedUserIdSet);
    }

    return formatted;
  } catch (error) {
    logger.error(`Error in getSingleContent [${contentType}] id:${contentId}`, error);
    throw error;
  }
};
/**
 * Update content
 */
export const updateContent = async (
  contentType,
  contentId,
  userId,
  updateData,
  currentUserId = null
) => {
  const Model = getContentModel(contentType);

  const ownerField =
    contentType === ContentType.POLL ? "createdBy" : "userId";

  const item = await Model.findById(contentId);

  if (!item) throw new Error(`${contentType} not found`);

  const ownerId =
    item[ownerField]?._id?.toString() ||
    item[ownerField]?.toString();

  if (ownerId !== userId.toString()) {
    throw new Error("You are not authorized to update this content");
  }

  // ZEAL restrictions
  if (contentType === ContentType.ZEAL) {
    if (item.status === "processing") {
      throw new Error("Cannot update Zeal Post while processing");
    }

    if (item.status === "published") {
      const allowedFields = [
        "caption",
        "images",
        "videos",
        "mentionedUserIds",
        "musicId",
        "musicStartTime",
        "musicEndTime",
      ];

      updateData = Object.keys(updateData)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = updateData[key];
          return obj;
        }, {});
    }
  }

  // POLL restriction
  if (
    contentType === ContentType.POLL &&
    item.status === "Active" &&
    updateData.options
  ) {
    throw new Error("Cannot update options of an active poll");
  }

  Object.assign(item, updateData);
  await item.save();

  // Re-fetch with safe population
  let query = Model.findById(contentId);
  query = applyPopulation(query, contentType);

  const updatedItem = await query;

  const contentIdObj = new mongoose.Types.ObjectId(contentId);
  const [likeCount, commentCount, shareCount] = await Promise.all([
    ContentLike.countDocuments({ contentType, contentId: contentIdObj }),
    Comment.countDocuments({ contentType, contentId: contentIdObj, isDeleted: false }),
    ContentShare.countDocuments({ contentType, contentId: contentIdObj }),
  ]);

  let isLiked = false;
  if (currentUserId) {
    const existingLike = await ContentLike.findOne({
      contentType,
      contentId: contentIdObj,
      userId: currentUserId,
    });
    isLiked = !!existingLike;
  }

  return formatContent(
    updatedItem,
    contentType,
    { likeCount, commentCount, shareCount },
    isLiked
  );
};

/**
 * Delete content
 */
export const deleteContent = async (
  contentType,
  contentId,
  userId
) => {
  const Model = getContentModel(contentType);
  const item = await Model.findById(contentId);

  if (!item) throw new Error(`${contentType} not found`);

  const ownerField =
    contentType === ContentType.POLL ? "createdBy" : "userId";

  const ownerId =
    item[ownerField]?._id?.toString() ||
    item[ownerField]?.toString();

  if (ownerId !== userId.toString()) {
    throw new Error("You are not authorized to delete this content");
  }

  if (
    contentType === ContentType.ZEAL &&
    item.status === "processing"
  ) {
    throw new Error("Cannot delete Zeal Post while processing");
  }

  if (
    contentType === ContentType.POLL &&
    item.userVotes?.length > 0
  ) {
    throw new Error("Cannot delete poll after votes are cast");
  }

  await Model.deleteOne({ _id: contentId });

  return { message: `${contentType} deleted successfully` };
};