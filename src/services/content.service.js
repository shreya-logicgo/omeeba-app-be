// services/content.service.js
import { getContentModel } from "../utils/contentModel.js";
import logger from "../utils/logger.js";
import { ContentType } from "../models/enums.js";

/**
 * Helper: format content item JSON for all content types
 */
const formatContent = (item, contentType, metrics = {}, isLiked = false, isSaved = false) => {
  const user = item.userId || item.createdBy;
  const baseItem = {
    id: item._id.toString(),
    contentType,
    userId: {
      id: user?._id?.toString(),
      name: user?.name,
      username: user?.username,
      profileImage: user?.profileImage,
      isAccountVerified: user?.isAccountVerified,
      isVerifiedBadge: user?.isVerifiedBadge,
    },
    mentionedUsers: (item.mentionedUserIds || []).map((u) => ({
      id: u._id.toString(),
      name: u.name,
      username: u.username,
      profileImage: u.profileImage,
      isAccountVerified: u.isAccountVerified,
      isVerifiedBadge: u.isVerifiedBadge,
    })),
    likeCount: metrics.likeCount || 0,
    commentCount: metrics.commentCount || 0,
    shareCount: metrics.shareCount || 0,
    isLiked,
    isSaved,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  switch (contentType) {
    case ContentType.POST:
      return {
        ...baseItem,
        caption: item.caption || "",
        images: item.images || [],
        music: item.musicId
          ? {
              id: item.musicId._id.toString(),
              title: item.musicId.title,
              artist: item.musicId.artist,
              album: item.musicId.album,
              coverImage: item.musicId.coverImage,
              duration: item.musicId.duration,
            }
          : null,
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
        music: item.musicId
          ? {
              id: item.musicId._id.toString(),
              title: item.musicId.title,
              artist: item.musicId.artist,
              album: item.musicId.album,
              coverImage: item.musicId.coverImage,
              duration: item.musicId.duration,
            }
          : null,
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
        totalVotes: item.totalVotes || 0,
        userVotes: item.userVotes || [],
        status: item.status,
        duration: item.duration,
      };
    default:
      return baseItem;
  }
};

/**
 * Get single content by contentType and contentId
 */
export const getSingleContent = async (contentType, contentId) => {
  try {
    const Model = getContentModel(contentType);
    const userField = contentType === ContentType.POLL ? "createdBy" : "userId";

    // Only populate fields that exist
    const populateFields = [userField];
    if (Model.schema.path("mentionedUserIds")) {
      populateFields.push({
        path: "mentionedUserIds",
        select: "name username profileImage isAccountVerified isVerifiedBadge",
      });
    }

    const content = await Model.findById(contentId).populate(populateFields);

    if (!content) throw new Error(`${contentType} not found`);

    const metrics = {
      likeCount: content.likeCount || 0,
      commentCount: content.commentCount || 0,
      shareCount: content.shareCount || 0,
    };

    return formatContent(
      contentType === "ZEAL_POST" ? { ...content.toObject(), userId: content.userId } : content,
      contentType === "ZEAL_POST" ? ContentType.ZEAL : contentType,
      metrics
    );
  } catch (error) {
    logger.error(`Error in getSingleContent [${contentType}] id:${contentId}`, error);
    throw error;
  }
};

export const updateContent = async (contentType, contentId, userId, updateData) => {
  const Model = getContentModel(contentType);
  const item = await Model.findById(contentId);

  if (!item) throw new Error(`${contentType} not found`);

  const ownerField = contentType === "Poll" ? "createdBy" : "userId";
  const ownerId = item[ownerField]?._id?.toString() || item[ownerField]?.toString();

  if (ownerId !== userId.toString()) {
    throw new Error("You are not authorized to update this content");
  }

  // Status-based restrictions
  if (contentType === "Zeal Post") {
    if (item.status === "processing") throw new Error("Cannot update Zeal Post while processing");
    if (item.status === "published") {
      const allowedFields = ["caption", "images", "videos"];
      updateData = Object.keys(updateData)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => ((obj[key] = updateData[key]), obj), {});
    }
  }

  if (contentType === "Poll" && item.status === "Active" && updateData.options) {
    throw new Error("Cannot update options of an active poll");
  }

  // Update and save
  Object.assign(item, updateData);
  await item.save();

  // Compute metrics if needed
  const metrics = {
    likeCount: item.likeCount || 0,
    commentCount: item.commentCount || 0,
    shareCount: item.shareCount || 0,
  };

  // Format response for frontend
  return formatContent(item, contentType, metrics);
};

/**
 * Delete content by contentType and contentId
 */
export const deleteContent = async (contentType, contentId, userId) => {
  const Model = getContentModel(contentType);
  const item = await Model.findById(contentId);

  if (!item) throw new Error(`${contentType} not found`);

  const ownerField = contentType === "Poll" ? "createdBy" : "userId";
  const ownerId = item[ownerField]?._id?.toString() || item[ownerField]?.toString();

  if (ownerId !== userId.toString()) {
    throw new Error("You are not authorized to delete this content");
  }

  // Status restrictions
  if (contentType === "Zeal Post" && item.status === "processing") {
    throw new Error("Cannot delete Zeal Post while processing");
  }
  if (contentType === "Poll" && item.userVotes?.length > 0) {
    throw new Error("Cannot delete poll after votes are cast");
  }

  // Soft delete
  if ((contentType === "Zeal Post" && item.status === "published") ||
      (contentType === "Poll" && item.status === "Active")) {
    item.isDeleted = true;
    await item.save();
    return formatContent(item, contentType); // return formatted object
  }

  // Hard delete
  await Model.deleteOne({ _id: contentId });
  return { message: `${contentType} deleted successfully` };
};