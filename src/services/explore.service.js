/**
 * Explore Service
 * Business logic for fetching trending/popular content for Explore landing screen
 */

import {
  Post,
  WritePost,
  ZealPost,
  Poll,
  ContentLike,
  ContentShare,
  Comment,
  User,
  UserFollower,
  ChatRoom,
  SavedContent,
} from "../models/index.js";
import Hashtag from "../models/hashtags/Hashtag.js";
import HashtagContent from "../models/hashtags/HashtagContent.js";
import { ContentType, ZealStatus, PollStatus } from "../models/enums.js";
import { getReportedContentIds } from "../utils/contentFilter.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { getIsFollowing } from "../utils/followUtils.js";

/**
 * Get blocked user IDs for a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @returns {Promise<Array<mongoose.Types.ObjectId>>} Array of blocked user IDs
 */
const getBlockedUserIds = async (userId) => {
  try {
    const blockedRooms = await ChatRoom.find({
      $or: [
        { userA: userId, isBlocked: true },
        { userB: userId, isBlocked: true },
      ],
    }).select("userA userB");

    const blockedUserIds = new Set();

    blockedRooms.forEach((room) => {
      if (room.userA.toString() === userId.toString()) {
        blockedUserIds.add(room.userB.toString());
      } else {
        blockedUserIds.add(room.userA.toString());
      }
    });

    return Array.from(blockedUserIds).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
  } catch (error) {
    logger.error("Error getting blocked user IDs:", error);
    return [];
  }
};

/**
 * Get followed user IDs for a user
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @returns {Promise<Set<string>>} Set of followed user IDs as strings
 */
const getFollowedUserIdSet = async (userId) => {
  if (!userId) return new Set();
  try {
    const followRows = await UserFollower.find({
      followerId: new mongoose.Types.ObjectId(userId),
    })
      .select("userId")
      .lean();
    return new Set(
      followRows.map((row) => row.userId?.toString()).filter(Boolean)
    );
  } catch (error) {
    logger.error("Error getting followed user IDs:", error);
    return new Set();
  }
};

/**
 * Get engagement metrics for content items
 * @param {Array} contentItems - Array of content items with contentType and _id
 * @returns {Promise<Map>} Map of contentId -> { likeCount, commentCount, shareCount }
 */
const getEngagementMetrics = async (contentItems) => {
  const metricsMap = new Map();

  if (contentItems.length === 0) {
    return metricsMap;
  }

  // Group by content type
  const byType = {
    [ContentType.POST]: [],
    [ContentType.WRITE_POST]: [],
    [ContentType.ZEAL]: [],
    [ContentType.POLL]: [],
  };

  contentItems.forEach((item) => {
    if (byType[item.contentType]) {
      byType[item.contentType].push(item._id);
    }
  });

  // Fetch metrics in parallel for each content type
  const metricPromises = [];

  for (const [contentType, contentIds] of Object.entries(byType)) {
    if (contentIds.length === 0) continue;

    // Get likes
    metricPromises.push(
      ContentLike.aggregate([
        {
          $match: {
            contentType,
            contentId: { $in: contentIds },
          },
        },
        {
          $group: {
            _id: "$contentId",
            likeCount: { $sum: 1 },
          },
        },
      ])
    );

    // Get comments (only non-deleted, to match comments API count)
    metricPromises.push(
      Comment.aggregate([
        {
          $match: {
            contentType,
            contentId: { $in: contentIds },
            isDeleted: false,
          },
        },
        {
          $group: {
            _id: "$contentId",
            commentCount: { $sum: 1 },
          },
        },
      ])
    );

    // Get shares (using shareCount from content documents for performance)
    // We'll also get from ContentShare for accuracy if needed
    metricPromises.push(
      ContentShare.aggregate([
        {
          $match: {
            contentType,
            contentId: { $in: contentIds },
          },
        },
        {
          $group: {
            _id: {
              contentId: "$contentId",
              senderId: "$senderId"
            },
          },
        },
        {
          $group: {
            _id: "$_id.contentId",
            shareCount: { $sum: 1 },
          },
        },
      ])
    );
  }

  const results = await Promise.all(metricPromises);

  // Process results and build metrics map
  let resultIndex = 0;
  for (const [, contentIds] of Object.entries(byType)) {
    if (contentIds.length === 0) continue;

    // Process likes
    const likes = results[resultIndex++] || [];
    likes.forEach((item) => {
      const id = item._id.toString();
      if (!metricsMap.has(id)) {
        metricsMap.set(id, { likeCount: 0, commentCount: 0, shareCount: 0 });
      }
      metricsMap.get(id).likeCount = item.likeCount;
    });

    // Process comments
    const comments = results[resultIndex++] || [];
    comments.forEach((item) => {
      const id = item._id.toString();
      if (!metricsMap.has(id)) {
        metricsMap.set(id, { likeCount: 0, commentCount: 0, shareCount: 0 });
      }
      metricsMap.get(id).commentCount = item.commentCount;
    });

    // Process shares
    const shares = results[resultIndex++] || [];
    shares.forEach((item) => {
      const id = item._id.toString();
      if (!metricsMap.has(id)) {
        metricsMap.set(id, { likeCount: 0, commentCount: 0, shareCount: 0 });
      }
      metricsMap.get(id).shareCount = item.shareCount;
    });
  }

  // Initialize metrics for items that don't have any engagement yet
  contentItems.forEach((item) => {
    const id = item._id.toString();
    if (!metricsMap.has(id)) {
      metricsMap.set(id, { likeCount: 0, commentCount: 0, shareCount: 0 });
    }
  });

  return metricsMap;
};

/**
 * Calculate trending score based on engagement and recency
 * @param {Object} metrics - Engagement metrics { likeCount, commentCount, shareCount }
 * @param {Date} createdAt - Content creation date
 * @returns {number} Trending score
 */
const calculateTrendingScore = (metrics, createdAt) => {
  const { likeCount = 0, commentCount = 0, shareCount = 0 } = metrics;

  // Weight factors for engagement signals
  const LIKE_WEIGHT = 1;
  const COMMENT_WEIGHT = 2; // Comments are more valuable than likes
  const SHARE_WEIGHT = 3; // Shares are most valuable

  // Calculate engagement score
  const engagementScore =
    likeCount * LIKE_WEIGHT +
    commentCount * COMMENT_WEIGHT +
    shareCount * SHARE_WEIGHT;

  // Recency factor (decay over time)
  const now = new Date();
  const ageInHours = (now - createdAt) / (1000 * 60 * 60);
  const recencyFactor = Math.max(0, 1 - ageInHours / 168); // Decay over 7 days (168 hours)

  // Combine engagement and recency
  const trendingScore = engagementScore * (1 + recencyFactor);

  return trendingScore;
};

/**
 * Home feed engagement score: (likes × 5) + (comments × 10) + (shares × 15) + recencyScore
 * recencyScore: higher for newer content, decay over ~7 days
 * @param {Object} metrics - { likeCount, commentCount, shareCount }
 * @param {Date} createdAt - Content creation date
 * @returns {number} Engagement score for home feed ordering
 */
const calculateHomeFeedEngagementScore = (metrics, createdAt) => {
  const { likeCount = 0, commentCount = 0, shareCount = 0 } = metrics;
  const now = new Date();
  const ageInHours = (now - new Date(createdAt)) / (1000 * 60 * 60);
  const recencyScore = Math.max(0, 100 - ageInHours * (100 / 168)); // Decay over 168 hrs (7 days)
  return (
    likeCount * 5 +
    commentCount * 10 +
    shareCount * 15 +
    recencyScore
  );
};

/**
 * Get liked content IDs for a user (bulk query for efficiency)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {Array} contentItems - Array of content items with contentType and _id
 * @returns {Promise<Set>} Set of liked content IDs (as strings)
 */
const getLikedContentIds = async (userId, contentItems) => {
  if (!userId || contentItems.length === 0) {
    return new Set();
  }

  try {
    // Group by content type
    const byType = {
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
      [ContentType.POLL]: [],
    };

    contentItems.forEach((item) => {
      if (byType[item.contentType]) {
        byType[item.contentType].push(item._id);
      }
    });

    // Fetch likes for all content types in parallel
    const likePromises = [];
    for (const [contentType, contentIds] of Object.entries(byType)) {
      if (contentIds.length > 0) {
        likePromises.push(
          ContentLike.find({
            contentType,
            contentId: { $in: contentIds },
            userId,
          })
            .select("contentId")
            .lean()
        );
      }
    }

    const likeResults = await Promise.all(likePromises);
    const likedIds = new Set();

    likeResults.forEach((likes) => {
      likes.forEach((like) => {
        likedIds.add(like.contentId.toString());
      });
    });

    return likedIds;
  } catch (error) {
    logger.error("Error getting liked content IDs:", error);
    return new Set();
  }
};

/**
 * Get saved content IDs for a user (bulk query for efficiency)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {Array} contentItems - Array of content items with contentType and _id
 * @returns {Promise<Set>} Set of saved content IDs (as strings)
 */
const getSavedContentIds = async (userId, contentItems) => {
  if (!userId || contentItems.length === 0) {
    return new Set();
  }

  try {
    // Group by content type
    const byType = {
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
      [ContentType.POLL]: []
    };

    contentItems.forEach((item) => {
      if (byType[item.contentType]) {
        byType[item.contentType].push(item._id);
      }
    });

    // Fetch saved content for all content types in parallel
    const savedPromises = [];
    for (const [contentType, contentIds] of Object.entries(byType)) {
      if (contentIds.length > 0) {
        savedPromises.push(
          SavedContent.find({
            contentType,
            contentId: { $in: contentIds },
            userId,
          })
            .select("contentId")
            .lean()
        );
      }
    }

    const savedResults = await Promise.all(savedPromises);
    const savedIds = new Set();

    savedResults.forEach((savedItems) => {
      savedItems.forEach((saved) => {
        savedIds.add(saved.contentId.toString());
      });
    });

    return savedIds;
  } catch (error) {
    logger.error("Error getting saved content IDs:", error);
    return new Set();
  }
};

/**
 * Format content item with metadata
 * @param {Object} item - Content item
 * @param {Object} metrics - Engagement metrics
 * @param {string} contentType - Content type
 * @param {boolean} isLiked - Whether the content is liked by the current user
 * @param {boolean} isSaved - Whether the content is saved by the current user
 * @returns {Object} Formatted content item
 */
import { generateShareableLink } from "../utils/shareableLink.js";

const formatContentItem = (
  item,
  metrics,
  contentType,
  isLiked = false,
  isSaved = false,
  isFollowing = false
) => {
  const baseItem = {
    id: item._id.toString(),
    contentType,
    shareableLink: generateShareableLink(contentType, item._id),
    userId: {
      id: item.userId._id.toString(),
      name: item.userId.name,
      username: item.userId.username,
      profileImage: item.userId.profileImage,
      isAccountVerified: item.userId.isAccountVerified,
      isVerifiedBadge: item.userId.isVerifiedBadge,
    },
    mentionedUsers: (item.mentionedUserIds || []).map((user) => ({
      id: user._id.toString(),
      name: user.name,
      username: user.username,
      profileImage: user.profileImage,
      isAccountVerified: user.isAccountVerified,
      isVerifiedBadge: user.isVerifiedBadge,
    })),
    likeCount: metrics.likeCount || 0,
    commentCount: metrics.commentCount || 0,
    shareCount: metrics.shareCount || 0,
    isLiked,
    isSaved,
    isFollowing,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };

  // Add type-specific fields
  if (contentType === ContentType.POST) {
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
  } else if (contentType === ContentType.WRITE_POST) {
    return {
      ...baseItem,
      content: item.content,
    };
  } else if (contentType === ContentType.ZEAL) {
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
  }

  return baseItem;
};

/**
 * Format content list with metrics/like/save metadata
 * @param {mongoose.Types.ObjectId} userId - User ID (optional)
 * @param {Array} contentItems - Array of content items
 * @returns {Promise<Array>} Formatted content items
 */
const formatContentList = async (userId, contentItems) => {
  if (!contentItems || contentItems.length === 0) {
    return [];
  }

  const metricsMap = await getEngagementMetrics(contentItems);
  const [likedContentIds, savedContentIds] = userId
    ? await Promise.all([
        getLikedContentIds(userId, contentItems),
        getSavedContentIds(userId, contentItems),
      ])
    : [new Set(), new Set()];
  const followedUserIdSet = userId
    ? new Set(
        (
          await UserFollower.find({
            followerId: new mongoose.Types.ObjectId(userId),
          })
            .select("userId")
            .lean()
        ).map((row) => row.userId?.toString())
      )
    : new Set();

  return contentItems.map((item) => {
    const metrics = metricsMap.get(item._id.toString()) || {
      likeCount: 0,
      commentCount: 0,
      shareCount: 0,
    };
    const isLiked = likedContentIds.has(item._id.toString());
    const isSaved = savedContentIds.has(item._id.toString());
    const isFollowing = getIsFollowing(item, userId, followedUserIdSet);

    // Handle Poll content type separately
    if (item.contentType === ContentType.POLL) {
      const formattedPoll = formatPollForFeed(item, metrics, isLiked, isSaved);
      return {
        ...formattedPoll,
        isFollowing,
      };
    }

    return formatContentItem(
      item,
      metrics,
      item.contentType,
      isLiked,
      isSaved,
      isFollowing
    );
  });
};

/**
 * Fetch latest content for given users across Post/Write/Zeal
 * @param {Array<mongoose.Types.ObjectId>} userIds - User IDs
 * @param {Object} reportedContentIds - Reported content IDs by type
 * @param {number} limit - Max items to return
 * @returns {Promise<Array>} Content items with contentType
 */
const fetchLatestContentByUsers = async (
  userIds,
  reportedContentIds,
  limit,
  contentTypes = null
) => {
  if (!userIds || userIds.length === 0 || limit <= 0) {
    return [];
  }

  const contentQueries = [];
  const typeSet = Array.isArray(contentTypes) && contentTypes.length > 0
    ? new Set(contentTypes)
    : null;
  const includePost = !typeSet || typeSet.has(ContentType.POST);
  const includeWrite = !typeSet || typeSet.has(ContentType.WRITE_POST);
  const includeZeal = !typeSet || typeSet.has(ContentType.ZEAL);

  if (includePost) {
    const postQuery = { userId: { $in: userIds } };
    if (reportedContentIds[ContentType.POST]?.length > 0) {
      postQuery._id = {
        $nin: reportedContentIds[ContentType.POST].map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      };
    }
    contentQueries.push(
      Post.find(postQuery)
        .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("musicId", "title artist album coverImage duration")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .then((posts) =>
          posts.map((post) => ({
            ...post,
            contentType: ContentType.POST,
          }))
        )
    );
  }

  if (includeWrite) {
    const writeQuery = { userId: { $in: userIds } };
    if (reportedContentIds[ContentType.WRITE_POST]?.length > 0) {
      writeQuery._id = {
        $nin: reportedContentIds[ContentType.WRITE_POST].map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      };
    }
    contentQueries.push(
      WritePost.find(writeQuery)
        .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .then((writes) =>
          writes.map((write) => ({
            ...write,
            contentType: ContentType.WRITE_POST,
          }))
        )
    );
  }

  if (includeZeal) {
    const zealQuery = {
      userId: { $in: userIds },
      status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
    };
    if (reportedContentIds[ContentType.ZEAL]?.length > 0) {
      zealQuery._id = {
        $nin: reportedContentIds[ContentType.ZEAL].map(
          (id) => new mongoose.Types.ObjectId(id)
        ),
      };
    }
    contentQueries.push(
      ZealPost.find(zealQuery)
        .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("musicId", "title artist album coverImage duration")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .then((zeals) =>
          zeals.map((zeal) => ({
            ...zeal,
            contentType: ContentType.ZEAL,
          }))
        )
    );
  }

  const contentArrays = await Promise.all(contentQueries);
  const allContent = contentArrays.flat();
  allContent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return allContent.slice(0, limit);
};

/**
 * Fetch own recent content (last 48 hrs) for home feed priority
 * @param {mongoose.Types.ObjectId} userId - Current user ID
 * @param {Object} reportedContentIds - Reported content IDs by type
 * @param {number} limit - Max items to return
 * @param {Array<string>} contentTypes - Content types to include
 * @returns {Promise<Array>} Content items with contentType
 */
const fetchOwnRecentContent = async (
  userId,
  reportedContentIds,
  limit,
  contentTypes = null
) => {
  if (!userId || limit <= 0) return [];
  const typeSet = Array.isArray(contentTypes) && contentTypes.length > 0 ? new Set(contentTypes) : null;
  const includePost = !typeSet || typeSet.has(ContentType.POST);
  const includeWrite = !typeSet || typeSet.has(ContentType.WRITE_POST);
  const includeZeal = !typeSet || typeSet.has(ContentType.ZEAL);
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const contentQueries = [];
  if (includePost) {
    const postQuery = {
      userId,
      createdAt: { $gte: fortyEightHoursAgo },
    };
    if (reportedContentIds[ContentType.POST]?.length > 0) {
      postQuery._id = { $nin: reportedContentIds[ContentType.POST].map((id) => new mongoose.Types.ObjectId(id)) };
    }
    contentQueries.push(
      Post.find(postQuery)
        .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("musicId", "title artist album coverImage duration")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .then((posts) => posts.map((p) => ({ ...p, contentType: ContentType.POST })))
    );
  }
  if (includeWrite) {
    const writeQuery = {
      userId,
      createdAt: { $gte: fortyEightHoursAgo },
    };
    if (reportedContentIds[ContentType.WRITE_POST]?.length > 0) {
      writeQuery._id = { $nin: reportedContentIds[ContentType.WRITE_POST].map((id) => new mongoose.Types.ObjectId(id)) };
    }
    contentQueries.push(
      WritePost.find(writeQuery)
        .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .then((writes) => writes.map((w) => ({ ...w, contentType: ContentType.WRITE_POST })))
    );
  }
  if (includeZeal) {
    const zealQuery = {
      userId,
      status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
      createdAt: { $gte: fortyEightHoursAgo },
    };
    if (reportedContentIds[ContentType.ZEAL]?.length > 0) {
      zealQuery._id = { $nin: reportedContentIds[ContentType.ZEAL].map((id) => new mongoose.Types.ObjectId(id)) };
    }
    contentQueries.push(
      ZealPost.find(zealQuery)
        .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("musicId", "title artist album coverImage duration")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean()
        .then((zeals) => zeals.map((z) => ({ ...z, contentType: ContentType.ZEAL })))
    );
  }
  if (contentQueries.length === 0) return [];
  const arrays = await Promise.all(contentQueries);
  const all = arrays.flat();
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return all.slice(0, limit);
};
/**
 * Fetch latest polls by given users (Poll uses createdBy)
 * @param {Array<mongoose.Types.ObjectId>} userIds - User IDs (createdBy)
 * @param {number} limit - Max items to return
 * @returns {Promise<Array>} Poll items with contentType
 */
const fetchLatestPollsByUsers = async (userIds, reportedContentIds, limit) => {
  if (!userIds || userIds.length === 0 || limit <= 0) return [];

  const pollQuery = {
    createdBy: { $in: userIds },
  };

  if (reportedContentIds && reportedContentIds[ContentType.POLL]?.length > 0) {
    pollQuery._id = {
      $nin: reportedContentIds[ContentType.POLL].map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    };
  }

  const polls = await Poll.find(pollQuery)
    .populate("createdBy", "name username profileImage isAccountVerified isVerifiedBadge")
    .select("-__v")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return polls.map((p) => ({ ...p, contentType: ContentType.POLL }));
};

/**
 * Fetch trending polls (by totalVotes) and latest polls
 * @param {Array<mongoose.Types.ObjectId>} validUserIds - Valid user IDs
 * @param {Object} reportedContentIds - Reported content IDs by type
 * @param {number} limit - Max items
 * @returns {Promise<Array>} Polls sorted by totalVotes desc
 */
const fetchTrendingPolls = async (validUserIds, reportedContentIds, limit) => {
  if (!validUserIds || validUserIds.length === 0 || limit <= 0) return [];

  const pollQuery = {
    createdBy: { $in: validUserIds },
  };

  if (reportedContentIds && reportedContentIds[ContentType.POLL]?.length > 0) {
    pollQuery._id = {
      $nin: reportedContentIds[ContentType.POLL].map(
        (id) => new mongoose.Types.ObjectId(id)
      ),
    };
  }

  const polls = await Poll.find(pollQuery)
    .populate("createdBy", "name username profileImage isAccountVerified isVerifiedBadge")
    .select("-__v")
    .sort({ totalVotes: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return polls.map((p) => ({ ...p, contentType: ContentType.POLL }));
};

const formatPollForFeed = (poll, metrics = {}, isLiked = false, isSaved = false) => ({
  id: poll._id.toString(),
  contentType: ContentType.POLL,
  shareableLink: generateShareableLink(ContentType.POLL, poll._id),
  caption: poll.caption || "",
  options: poll.options || [],
  totalVotes: poll.totalVotes || 0,
  status: poll.status,
  duration: poll.duration,
  createdBy: poll.createdBy
    ? {
        id: poll.createdBy._id.toString(),
        name: poll.createdBy.name,
        username: poll.createdBy.username,
        profileImage: poll.createdBy.profileImage,
        isAccountVerified: poll.createdBy.isAccountVerified,
        isVerifiedBadge: poll.createdBy.isVerifiedBadge,
      }
    : null,
  likeCount: metrics.likeCount || 0,
  commentCount: metrics.commentCount || 0,
  shareCount: metrics.shareCount || 0,
  isLiked,
  isSaved,
  createdAt: poll.createdAt,
  updatedAt: poll.updatedAt,
});

/** Get optionId the user voted for, or null */
const getUserSelectedOptionId = (poll, userId) => {
  if (!userId || !poll.userVotes?.length) return null;
  const userVote = poll.userVotes.find(
    (v) => v.userId.toString() === userId.toString()
  );
  return userVote ? userVote.optionId : null;
};

/** Add selectedByAuthUser flag to each option for feed/listing responses */
const addSelectedByAuthUserToOptions = (options, userSelectedOptionId) =>
  (options || []).map((opt) => ({
    ...opt,
    selectedByAuthUser:
      userSelectedOptionId != null && opt.optionId === userSelectedOptionId,
  }));

/**
 * Get trending content for Explore landing screen
 * @param {mongoose.Types.ObjectId} userId - User ID (optional, for filtering)
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @param {string} options.contentType - Filter by content type: 'all', 'post', 'write', 'zeal', 'poll', 'explore' (default: 'all')
 * @returns {Promise<Object>} Trending content with pagination
 */
export const getTrendingContent = async (userId = null, options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      contentType = "all", // 'all', 'post', 'write', 'zeal', 'poll', 'explore'
    } = options;

    const skip = (page - 1) * limit;

    // Get blocked users if userId is provided
    let followedUserIdSet = new Set();
    let blockedUserIds = [];
    let reportedContentIds = {
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
      [ContentType.POLL]: [],
    };

    if (userId) {
      [blockedUserIds, followedUserIdSet] = await Promise.all([
        getBlockedUserIds(userId),
        getFollowedUserIdSet(userId),
      ]);
      try {
        reportedContentIds = await getReportedContentIds(userId);
      } catch (error) {
        logger.error("Error getting reported content IDs:", error);
        // Continue with empty reported content if there's an error
        reportedContentIds = {
          [ContentType.POST]: [],
          [ContentType.WRITE_POST]: [],
          [ContentType.ZEAL]: [],
          [ContentType.POLL]: [],
        };
      }
    }

    // Build base query to exclude blocked users and deleted users
    const baseUserQuery = {
      isDeleted: false,
    };

    if (blockedUserIds.length > 0) {
      baseUserQuery._id = { $nin: blockedUserIds };
    }

    // Get valid user IDs
    const validUsers = await User.find(baseUserQuery).select("_id");
    const validUserIds = validUsers.map((u) => u._id);

    if (validUserIds.length === 0) {
      return {
        content: [],
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // Build content queries
    const contentQueries = [];

    // Posts query
    if (contentType === "all" || contentType === "post" || contentType === "explore") {
      const postQuery = {
        userId: { $in: validUserIds },
      };

      if (reportedContentIds[ContentType.POST].length > 0) {
        postQuery._id = {
          $nin: reportedContentIds[ContentType.POST].map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      contentQueries.push(
        Post.find(postQuery)
          .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("musicId", "title artist album coverImage duration")
          .select("-__v")
          .lean()
          .then((posts) =>
            posts.map((post) => ({
              ...post,
              contentType: ContentType.POST,
            }))
          )
      );
    }

    // Write Posts query
    if (contentType === "all" || contentType === "write") {
      const writeQuery = {
        userId: { $in: validUserIds },
      };

      if (reportedContentIds[ContentType.WRITE_POST].length > 0) {
        writeQuery._id = {
          $nin: reportedContentIds[ContentType.WRITE_POST].map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      contentQueries.push(
        WritePost.find(writeQuery)
          .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
          .select("-__v")
          .lean()
          .then((writes) =>
            writes.map((write) => ({
              ...write,
              contentType: ContentType.WRITE_POST,
            }))
          )
      );
    }

    // Zeal Posts query (only published/ready)
    if (contentType === "all" || contentType === "zeal" || contentType === "explore") {
      const zealQuery = {
        userId: { $in: validUserIds },
        status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
      };

      if (reportedContentIds[ContentType.ZEAL].length > 0) {
        zealQuery._id = {
          $nin: reportedContentIds[ContentType.ZEAL].map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      contentQueries.push(
        ZealPost.find(zealQuery)
          .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("musicId", "title artist album coverImage duration")
          .select("-__v")
          .lean()
          .then((zeals) =>
            zeals.map((zeal) => ({
              ...zeal,
              contentType: ContentType.ZEAL,
            }))
          )
      );
    }

    // Polls query (only active)
    if (contentType === "all" || contentType === "poll") {
      const pollQuery = {
        createdBy: { $in: validUserIds },
        // status: PollStatus.ACTIVE,
      };

      if (reportedContentIds[ContentType.POLL]?.length) {
        pollQuery._id = {
          $nin: reportedContentIds[ContentType.POLL].map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      contentQueries.push(
        Poll.find(pollQuery)
          .populate("createdBy", "name username profileImage isAccountVerified isVerifiedBadge")
          .select("-__v")
          .lean()
          .then((polls) =>
            polls.map((poll) => ({
              ...poll,
              contentType: ContentType.POLL,
            }))
          )
      );
    }

    // Fetch all content in parallel
    const contentArrays = await Promise.all(contentQueries);
    let allContent = contentArrays.flat();

    if (allContent.length === 0) {
      return {
        content: [],
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // -----------------------------------------
    // Engagement Metrics (ALL TYPES)
    // -----------------------------------------
    const metricsMap = await getEngagementMetrics(allContent);

    const [likedContentIds, savedContentIds] = userId
      ? await Promise.all([
          getLikedContentIds(userId, allContent),
          getSavedContentIds(userId, allContent),
        ])
      : [new Set(), new Set()];

    // -----------------------------------------
    // Trending Score Calculation
    // -----------------------------------------
    const contentWithScores = allContent.map((item) => {
      const metrics = metricsMap.get(item._id.toString()) || {
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
      };

      let trendingScore;

      if (item.contentType === ContentType.POLL) {
        const totalVotes = item.totalVotes || 0;

        const ageInHours =
          (Date.now() - new Date(item.createdAt).getTime()) /
          (1000 * 60 * 60);

        const recencyFactor = Math.max(0, 1 - ageInHours / 168);

        trendingScore =
          totalVotes * 2 +
          metrics.likeCount +
          metrics.commentCount * 2 +
          metrics.shareCount * 3 +
          recencyFactor * 10;
      } else {
        trendingScore = calculateTrendingScore(metrics, item.createdAt);
      }

      return {
        ...item,
        metrics,
        trendingScore,
      };
    });

    contentWithScores.sort((a, b) => b.trendingScore - a.trendingScore);

    const total = contentWithScores.length;
    const paginatedContent = contentWithScores.slice(skip, skip + limit);

    // -----------------------------------------
    // Final Formatting
    // -----------------------------------------
    const formattedContent = paginatedContent.map((item) => {
      const isLiked = likedContentIds.has(item._id.toString());
      const isSaved = savedContentIds.has(item._id.toString());
      const isFollowing = getIsFollowing(item, userId, followedUserIdSet);

      if (item.contentType === ContentType.POLL) {
        const userSelectedOptionId = getUserSelectedOptionId(item, userId);

        return {
          id: item._id.toString(),
          contentType: ContentType.POLL,
          shareableLink: generateShareableLink(ContentType.POLL, item._id),
          caption: item.caption || "",
          options: addSelectedByAuthUserToOptions(
            item.options,
            userSelectedOptionId
          ),
          totalVotes: item.totalVotes || 0,
          status: item.status,
          duration: item.duration,
          createdBy: {
            id: item.createdBy._id.toString(),
            name: item.createdBy.name,
            username: item.createdBy.username,
            profileImage: item.createdBy.profileImage,
            isAccountVerified: item.createdBy.isAccountVerified,
            isVerifiedBadge: item.createdBy.isVerifiedBadge,
          },
          likeCount: item.metrics.likeCount,
          commentCount: item.metrics.commentCount,
          shareCount: item.metrics.shareCount,
          isLiked,
          isSaved,
          isFollowing,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }

      return formatContentItem(
        item,
        item.metrics,
        item.contentType,
        isLiked,
        isSaved,
        isFollowing
      );
    });

    return {
      content: formattedContent,
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getTrendingContent:", error);
    throw error;
  }
};

/**
 * Get home feed content
 * Order: 1) Own recent (24–48 hrs), 2) Following (engagement weighted), 3) Suggested/trending, 4) Recent fallback
 * engagementScore = (likes × 5) + (comments × 10) + (shares × 15) + recencyScore
 * @param {mongoose.Types.ObjectId} userId - User ID (required)
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @returns {Promise<Object>} Home feed content with pagination
 */
export const getHomeFeed = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20, item = "all" } = options;
    const skip = (page - 1) * limit;
    const fetchLimit = limit * (page + 1);

    // Get blocked users + reported content
    let blockedUserIds = [];
    let reportedContentIds = {
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
      [ContentType.POLL]: [],
    };

    if (userId) {
      blockedUserIds = await getBlockedUserIds(userId);
      try {
        reportedContentIds = await getReportedContentIds(userId);
      } catch (error) {
        logger.error("Error getting reported content IDs:", error);
      }
    }

    const baseUserQuery = { isDeleted: false };
    if (blockedUserIds.length > 0) {
      baseUserQuery._id = { $nin: blockedUserIds };
    }

    const validUsers = await User.find(baseUserQuery).select("_id");
    const validUserIds = validUsers.map((u) => u._id);
    const validUserIdSet = new Set(validUserIds.map((id) => id.toString()));

    // Map item filter to content types
    const normalizedItem = String(item || "all").toLowerCase();
    const itemMap = {
      post: [ContentType.POST],
      posts: [ContentType.POST],
      write: [ContentType.WRITE_POST],
      writes: [ContentType.WRITE_POST],
      zeal: [ContentType.ZEAL],
      zeels: [ContentType.ZEAL],
      zeals: [ContentType.ZEAL],
      poll: [ContentType.POLL],
      polls: [ContentType.POLL],
      all: [ContentType.POST, ContentType.WRITE_POST
        , ContentType.POLL],
    };

    const contentTypes = itemMap[normalizedItem] || itemMap.all;
    const contentTypeSet = new Set(contentTypes);
    const includePolls = contentTypeSet.has(ContentType.POLL);

    // Helper: add selectedByAuthUser flag on each option for logged-in user
    const attachSelectedOption = async (poll) => {
      // Get metrics and user status for this poll
      const pollMetrics = await getEngagementMetrics([poll]);
      const metrics = pollMetrics.get(poll._id.toString()) || {
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
      };
      
      const [likedContentIds, savedContentIds] = userId
        ? await Promise.all([
            getLikedContentIds(userId, [poll]),
            getSavedContentIds(userId, [poll]),
          ])
        : [new Set(), new Set()];
      
      const isLiked = likedContentIds.has(poll._id.toString());
      const isSaved = savedContentIds.has(poll._id.toString());
      
      const formattedPoll = formatPollForFeed(poll, metrics, isLiked, isSaved);
      const userSelectedOptionId = getUserSelectedOptionId(poll, userId);
      const optionsWithFlag = addSelectedByAuthUserToOptions(
        formattedPoll.options,
        userSelectedOptionId
      );
      return {
        ...formattedPoll,
        options: optionsWithFlag,
      };
    };

    const combined = [];
    const seen = new Set();
    const addUnique = (items) => {
      items.forEach((item) => {
        const key = `${item.contentType}:${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      });
    };

    // 1) Own recent posts (last 24–48 hrs / 48 hrs)
    let ownRecentContent = [];
    if (userId) {
      const ownRaw = await fetchOwnRecentContent(
        userId,
        reportedContentIds,
        fetchLimit,
        contentTypes.filter((t) => t !== ContentType.POLL)
      );
      ownRecentContent = await formatContentList(userId, ownRaw);
    }
    addUnique(ownRecentContent);

    // Followed user IDs
    let followedUserIds = [];
    if (userId) {
      const followRows = await UserFollower.find({ followerId: new mongoose.Types.ObjectId(userId) })
        .select("userId")
        .lean();
      followedUserIds = followRows
        .map((row) => row.userId?.toString())
        .filter((id) => id && validUserIdSet.has(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }
    const followedUserIdSet = new Set(followedUserIds.map((id) => id.toString()));

    // 2) Following users' posts (engagement weighted)
    let followedContent = [];
    if (followedUserIds.length > 0) {
      const followedRaw = await fetchLatestContentByUsers(
        followedUserIds,
        reportedContentIds,
        fetchLimit,
        contentTypes
      );
      const metricsMap = await getEngagementMetrics(followedRaw);
      const withScore = followedRaw.map((item) => {
        const metrics = metricsMap.get(item._id.toString()) || {
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
        };
        const engagementScore = calculateHomeFeedEngagementScore(metrics, item.createdAt);
        return { ...item, _engagementScore: engagementScore };
      });
      withScore.sort((a, b) => (b._engagementScore || 0) - (a._engagementScore || 0));
      const sortedFollowed = withScore.slice(0, fetchLimit).map(({ _engagementScore, ...item }) => item);
      followedContent = await formatContentList(userId, sortedFollowed);
    }
    addUnique(followedContent);

    // 2b) Followed users' polls (latest)
    if (includePolls && followedUserIds.length > 0) {
      const followedPollsRaw = await fetchLatestPollsByUsers(followedUserIds, reportedContentIds, fetchLimit);
      const followedPollsFormatted = await Promise.all(followedPollsRaw.map(attachSelectedOption));
      addUnique(followedPollsFormatted);
    }

    // 3) Suggested/trending posts
    const singleType =
      contentTypes.length === 1 && contentTypeSet.has(ContentType.POST)
        ? "post"
        : contentTypes.length === 1 && contentTypeSet.has(ContentType.WRITE_POST)
        ? "write"
        : contentTypes.length === 1 && contentTypeSet.has(ContentType.ZEAL)
        ? "zeal"
        : "all";
    let trendingContent = [];
    if (singleType !== "zeal") {
      const trendingResult = await getTrendingContent(userId, {
        page: 1,
        limit: fetchLimit,
        contentType: singleType,
      });
      trendingContent = (trendingResult.content || []).filter((c) =>
        contentTypeSet.has(c.contentType)
      );
    }
    addUnique(trendingContent);
    if (includePolls) {
      const trendingPollsRaw = await fetchTrendingPolls(validUserIds, reportedContentIds, fetchLimit);
      const trendingPollsFormatted = await Promise.all(trendingPollsRaw.map(attachSelectedOption));
      addUnique(trendingPollsFormatted);
    }

    // 4) Recent fallback (global latest)
    const latestRaw = await fetchLatestContentByUsers(
      validUserIds,
      reportedContentIds,
      fetchLimit,
      contentTypes
    );
    const latestContent = await formatContentList(userId, latestRaw);
    addUnique(latestContent);
    if (includePolls) {
      const latestPollsRaw = await fetchLatestPollsByUsers(validUserIds, reportedContentIds, fetchLimit);
      const latestPollsFormatted = await Promise.all(latestPollsRaw.map(attachSelectedOption));
      addUnique(latestPollsFormatted);
    }

    combined.forEach(item => {
      item.isFollowing = getIsFollowing(item, userId, followedUserIdSet);
    });

    // Sort combined content by createdAt (latest first) for proper home feed ordering
    combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const paginated = combined.slice(skip, skip + limit);
    const total = combined.length;

    return {
      content: paginated,
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getHomeFeed:", error);
    throw error;
  }
};


/**
 * Extract hashtags from text
 * @param {string} text - Text to extract hashtags from
 * @returns {Array<string>} Array of hashtags (without #)
 */
const extractHashtags = (text) => {
  if (!text) return [];
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  if (!matches) return [];
  return matches.map((tag) => tag.substring(1).toLowerCase());
};

/**
 * Search across multiple entities
 * @param {mongoose.Types.ObjectId} userId - User ID (optional)
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} options.type - Filter by type: 'all', 'content', 'users', 'hashtags', 'polls', 'post', 'write', 'zeal'
 * @param {string} options.sortBy - Sort by: 'relevance', 'popularity', 'recent' (default: 'relevance')
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @returns {Promise<Object>} Search results with pagination
 */
export const searchAcrossEntities = async (userId = null, options = {}) => {
  try {
    const {
      query = "",
      type = "all", // 'all', 'content', 'users', 'hashtags', 'polls', 'post', 'write', 'zeal'
      sortBy = "relevance", // 'relevance', 'popularity', 'recent'
      page = 1,
      limit = 20,
    } = options;

    if (!query || query.trim().length === 0) {
      return {
        results: {
          content: [],
          users: [],
          polls: [],
          hashtags: [],
        },
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // Get blocked users and reported content if userId is provided
    let blockedUserIds = [];
    let reportedContentIds = {
      [ContentType.POLL]: [],
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
    };

    if (userId) {
      blockedUserIds = await getBlockedUserIds(userId);
      try {
        reportedContentIds = await getReportedContentIds(userId);
      } catch (error) {
        logger.error("Error getting reported content IDs:", error);
      }
    }

    // Build base user query
    const baseUserQuery = {
      isDeleted: false,
    };

    if (blockedUserIds.length > 0) {
      baseUserQuery._id = { $nin: blockedUserIds };
    }

    const validUsers = await User.find(baseUserQuery).select("_id");
    const validUserIds = validUsers.map((u) => u._id);

    const results = {
      content: [],
      users: [],
      polls: [],
      hashtags: [],
    };

    const searchQuery = query.trim();
    const isHashtagQuery = searchQuery.startsWith("#");
    const searchTerm = isHashtagQuery ? searchQuery.substring(1) : searchQuery;

    // Search Users
    if (type === "all" || type === "users") {
      const userSearchQuery = {
        ...baseUserQuery,
        $or: [
          { name: { $regex: searchTerm, $options: "i" } },
          { username: { $regex: searchTerm, $options: "i" } },
          { bio: { $regex: searchTerm, $options: "i" } },
        ],
      };

      let userQuery = User.find(userSearchQuery)
        .select("name username profileImage bio isAccountVerified isVerifiedBadge followerCount")
        .lean();

      // Sort users
      if (sortBy === "popularity") {
        userQuery = userQuery.sort({ followerCount: -1 });
      } else {
        userQuery = userQuery.sort({ createdAt: -1 });
      }

      const users = await userQuery.limit(limit);
      results.users = users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio || "",
        isAccountVerified: user.isAccountVerified,
        isVerifiedBadge: user.isVerifiedBadge,
        followerCount: user.followerCount || 0,
      }));
    }

    // Search Content (Posts, WritePosts, ZealPosts)
    if (
      type === "all" ||
      type === "content" ||
      type === "post" ||
      type === "write" ||
      type === "zeal"
    ) {
      const contentQueries = [];

      // Search Posts
      if (type === "all" || type === "content" || type === "post") {
        const postQuery = {
          userId: { $in: validUserIds },
        };

        if (reportedContentIds[ContentType.POST].length > 0) {
          postQuery._id = {
            $nin: reportedContentIds[ContentType.POST].map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          };
        }

        if (isHashtagQuery) {
          postQuery.caption = { $regex: `#${searchTerm}\\b`, $options: "i" };
        } else {
          postQuery.$text = { $search: searchTerm };
        }

        contentQueries.push(
          Post.find(postQuery)
            .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("musicId", "title artist album coverImage duration")
            .select("-__v")
            .lean()
            .then((posts) =>
              posts.map((post) => ({
                ...post,
                contentType: ContentType.POST,
              }))
            )
        );
      }

      // Search WritePosts
      if (type === "all" || type === "content" || type === "write") {
        const writeQuery = {
          userId: { $in: validUserIds },
        };

        if (reportedContentIds[ContentType.WRITE_POST].length > 0) {
          writeQuery._id = {
            $nin: reportedContentIds[ContentType.WRITE_POST].map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          };
        }

        if (isHashtagQuery) {
          writeQuery.content = { $regex: `#${searchTerm}\\b`, $options: "i" };
        } else {
          writeQuery.$text = { $search: searchTerm };
        }

        contentQueries.push(
          WritePost.find(writeQuery)
            .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
            .select("-__v")
            .lean()
            .then((writes) =>
              writes.map((write) => ({
                ...write,
                contentType: ContentType.WRITE_POST,
              }))
            )
        );
      }

      // Search ZealPosts
      if (type === "all" || type === "content" || type === "zeal") {
        const zealQuery = {
          userId: { $in: validUserIds },
          status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
        };

        if (reportedContentIds[ContentType.ZEAL].length > 0) {
          zealQuery._id = {
            $nin: reportedContentIds[ContentType.ZEAL].map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          };
        }

        if (isHashtagQuery) {
          zealQuery.caption = { $regex: `#${searchTerm}\\b`, $options: "i" };
        } else {
          zealQuery.$text = { $search: searchTerm };
        }

        contentQueries.push(
          ZealPost.find(zealQuery)
            .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("musicId", "title artist album coverImage duration")
            .select("-__v")
            .lean()
            .then((zeals) =>
              zeals.map((zeal) => ({
                ...zeal,
                contentType: ContentType.ZEAL,
              }))
            )
        );
      }

      const contentArrays = await Promise.all(contentQueries);
      let allContent = contentArrays.flat();

      // Get engagement metrics
      const metricsMap = await getEngagementMetrics(allContent);

      // Get liked and saved content IDs
      const [likedContentIds, savedContentIds] = userId
        ? await Promise.all([
            getLikedContentIds(userId, allContent),
            getSavedContentIds(userId, allContent),
          ])
        : [new Set(), new Set()];

      // Attach metrics and calculate scores
      const contentWithMetrics = allContent.map((item) => {
        const metrics = metricsMap.get(item._id.toString()) || {
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
        };
        return {
          ...item,
          metrics,
          popularityScore:
            metrics.likeCount * 1 +
            metrics.commentCount * 2 +
            metrics.shareCount * 3,
        };
      });

      // Sort content
      if (sortBy === "popularity") {
        contentWithMetrics.sort((a, b) => b.popularityScore - a.popularityScore);
      } else if (sortBy === "recent") {
        contentWithMetrics.sort((a, b) => b.createdAt - a.createdAt);
      } else {
        // Relevance: combine text score with popularity
        contentWithMetrics.sort((a, b) => {
          const scoreA = a.popularityScore * 0.3 + (a.createdAt ? 1 : 0);
          const scoreB = b.popularityScore * 0.3 + (b.createdAt ? 1 : 0);
          return scoreB - scoreA;
        });
      }

      // Format content
      results.content = contentWithMetrics.map((item) => {
        const isLiked = likedContentIds.has(item._id.toString());
        const isSaved = savedContentIds.has(item._id.toString());
        return formatContentItem(
          item,
          item.metrics,
          item.contentType,
          isLiked,
          isSaved
        );
      });
    }

    // Search Polls
    if (type === "all" || type === "polls") {
      const pollQuery = {
        createdBy: { $in: validUserIds },
        // status: PollStatus.ACTIVE,
      };

      if (isHashtagQuery) {
        pollQuery.caption = { $regex: `#${searchTerm}\\b`, $options: "i" };
      } else {
        pollQuery.$text = { $search: searchTerm };
      }

      let pollQueryBuilder = Poll.find(pollQuery)
        .populate("createdBy", "name username profileImage isAccountVerified isVerifiedBadge")
        .select("-__v")
        .lean();

      // Sort polls
      if (sortBy === "popularity") {
        pollQueryBuilder = pollQueryBuilder.sort({ totalVotes: -1 });
      } else {
        pollQueryBuilder = pollQueryBuilder.sort({ createdAt: -1 });
      }

      const polls = await pollQueryBuilder.limit(limit);
      results.polls = polls.map((poll) => {
        const userSelectedOptionId = getUserSelectedOptionId(poll, userId);
        return {
          id: poll._id.toString(),
          caption: poll.caption || "",
          options: addSelectedByAuthUserToOptions(
            poll.options,
            userSelectedOptionId
          ),
          totalVotes: poll.totalVotes || 0,
          status: poll.status,
          duration: poll.duration,
          createdBy: {
            id: poll.createdBy._id.toString(),
            name: poll.createdBy.name,
            username: poll.createdBy.username,
            profileImage: poll.createdBy.profileImage,
            isAccountVerified: poll.createdBy.isAccountVerified,
            isVerifiedBadge: poll.createdBy.isVerifiedBadge,
          },
          createdAt: poll.createdAt,
        };
      });
    }

    // Extract and search hashtags
    if (type === "all" || type === "hashtags") {
      // Search for hashtags in all content types
      const hashtagRegex = new RegExp(`#${searchTerm}`, "i");
      const hashtagPromises = [];

      // Search in Posts
      hashtagPromises.push(
        Post.find({
          userId: { $in: validUserIds },
          caption: hashtagRegex,
        })
          .select("caption")
          .lean()
      );

      // Search in WritePosts
      hashtagPromises.push(
        WritePost.find({
          userId: { $in: validUserIds },
          content: hashtagRegex,
        })
          .select("content")
          .lean()
      );

      // Search in ZealPosts
      hashtagPromises.push(
        ZealPost.find({
          userId: { $in: validUserIds },
          status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
          caption: hashtagRegex,
        })
          .select("caption")
          .lean()
      );

      // Search in Polls
      hashtagPromises.push(
        Poll.find({
          createdBy: { $in: validUserIds },
          // status: PollStatus.ACTIVE,
          caption: hashtagRegex,
        })
          .select("caption")
          .lean()
      );

      const [posts, writes, zeals, polls] = await Promise.all(hashtagPromises);

      // Extract unique hashtags
      const hashtagMap = new Map();

      [...posts, ...writes, ...zeals, ...polls].forEach((item) => {
        const text = item.caption || item.content || "";
        const hashtags = extractHashtags(text);
        hashtags.forEach((tag) => {
          if (tag.toLowerCase().includes(searchTerm.toLowerCase())) {
            if (!hashtagMap.has(tag)) {
              hashtagMap.set(tag, 0);
            }
            hashtagMap.set(tag, hashtagMap.get(tag) + 1);
          }
        });
      });

      // Convert to array and sort by usage count
      results.hashtags = Array.from(hashtagMap.entries())
        .map(([tag, count]) => ({
          tag: `#${tag}`,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    }

    // Calculate totals for pagination
    const totalResults =
      results.content.length +
      results.users.length +
      results.polls.length +
      results.hashtags.length;

    return {
      results,
      pagination: getPaginationMeta(totalResults, page, limit),
    };
  } catch (error) {
    logger.error("Error in searchAcrossEntities:", error);
    throw error;
  }
};

/**
 * Get content by hashtag
 * @param {mongoose.Types.ObjectId} userId - User ID (optional)
 * @param {Object} options - Query options
 * @param {string} options.hashtag - Hashtag (with or without #)
 * @param {string} options.contentType - Filter by content type: 'all', 'post', 'write', 'zeal', 'poll'
 * @param {string} options.sortBy - Sort by: 'relevance', 'popularity', 'recent' (default: 'popularity')
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @returns {Promise<Object>} Content with pagination
 */
export const getContentByHashtag = async (userId = null, options = {}) => {
  try {
    const {
      hashtag = "",
      contentType = "all", // 'all', 'post', 'write', 'zeal', 'poll'
      sortBy = "popularity", // 'relevance', 'popularity', 'recent'
      page = 1,
      limit = 20,
    } = options;

    const skip = (page - 1) * limit;

    // Normalize hashtag (remove # if present)
    const normalizedHashtag = hashtag.startsWith("#")
      ? hashtag.substring(1)
      : hashtag;

    if (!normalizedHashtag || normalizedHashtag.trim().length === 0) {
      return {
        content: [],
        hashtag: `#${normalizedHashtag}`,
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // Get blocked users and reported content
    let blockedUserIds = [];
    let reportedContentIds = {
      [ContentType.POLL]: [],
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
    };

    if (userId) {
      blockedUserIds = await getBlockedUserIds(userId);
      try {
        reportedContentIds = await getReportedContentIds(userId);
      } catch (error) {
        logger.error("Error getting reported content IDs:", error);
      }
    }

    // Build base user query
    const baseUserQuery = {
      isDeleted: false,
    };

    if (blockedUserIds.length > 0) {
      baseUserQuery._id = { $nin: blockedUserIds };
    }

    const validUsers = await User.find(baseUserQuery).select("_id");
    const validUserIds = validUsers.map((u) => u._id);

    const normalizedTag = normalizedHashtag.trim().toLowerCase();

    if (!normalizedTag) {
      return {
        content: [],
        hashtag: `#${normalizedHashtag}`,
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // Handle contentType=user - return users who created content with this hashtag
    if (contentType === "user") {
      const hashtagDoc = await Hashtag.findOne({ tag: normalizedTag });
      if (!hashtagDoc) {
        return {
          content: [],
          hashtag: `#${normalizedHashtag}`,
          pagination: null, // No pagination for users
        };
      }

      // Get all content linked to this hashtag
      const allContentLinks = await HashtagContent.find({
        hashtagId: hashtagDoc._id,
      })
        .select("contentType contentId")
        .lean();

      if (allContentLinks.length === 0) {
        return {
          content: [],
          hashtag: `#${normalizedHashtag}`,
          pagination: null,
        };
      }

      // Group content IDs by type
      const contentIdsByType = {
        [ContentType.POST]: [],
        [ContentType.WRITE_POST]: [],
        [ContentType.ZEAL]: [],
        Poll: [],
      };

      allContentLinks.forEach((link) => {
        if (contentIdsByType[link.contentType]) {
          contentIdsByType[link.contentType].push(link.contentId);
        }
      });

      // Fetch all content and extract unique user IDs
      const userIdSet = new Set();
      
      // Get Post creators
      if (contentIdsByType[ContentType.POST].length > 0) {
        const posts = await Post.find({
          _id: { $in: contentIdsByType[ContentType.POST] },
          userId: { $in: validUserIds },
        })
          .select("userId")
          .lean();
        posts.forEach((p) => userIdSet.add(p.userId.toString()));
      }

      // Get WritePost creators
      if (contentIdsByType[ContentType.WRITE_POST].length > 0) {
        const writes = await WritePost.find({
          _id: { $in: contentIdsByType[ContentType.WRITE_POST] },
          userId: { $in: validUserIds },
        })
          .select("userId")
          .lean();
        writes.forEach((w) => userIdSet.add(w.userId.toString()));
      }

      // Get ZealPost creators
      if (contentIdsByType[ContentType.ZEAL].length > 0) {
        const zeals = await ZealPost.find({
          _id: { $in: contentIdsByType[ContentType.ZEAL] },
          userId: { $in: validUserIds },
          status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
        })
          .select("userId")
          .lean();
        zeals.forEach((z) => userIdSet.add(z.userId.toString()));
      }

      // Get Poll creators
      if (contentIdsByType[ContentType.POLL].length > 0) {
        const polls = await Poll.find({
          _id: { $in: contentIdsByType[ContentType.POLL] },
          createdBy: { $in: validUserIds },
          // status: PollStatus.ACTIVE,
        })
          .select("createdBy")
          .lean();
        polls.forEach((p) => userIdSet.add(p.createdBy.toString()));
      }

      const uniqueUserIds = Array.from(userIdSet).map((id) => new mongoose.Types.ObjectId(id));

      if (uniqueUserIds.length === 0) {
        return {
          content: [],
          hashtag: `#${normalizedHashtag}`,
          pagination: null,
        };
      }

      // Fetch users with follower counts
      const users = await User.find({
        _id: { $in: uniqueUserIds },
        isDeleted: false,
      })
        .select("name username profileImage bio isAccountVerified isVerifiedBadge")
        .lean();

      // Get follower counts for all users
      const followerCounts = await UserFollower.aggregate([
        {
          $match: {
            userId: { $in: uniqueUserIds },
          },
        },
        {
          $group: {
            _id: "$userId",
            followerCount: { $sum: 1 },
          },
        },
      ]);

      const followerCountMap = new Map();
      followerCounts.forEach((item) => {
        followerCountMap.set(item._id.toString(), item.followerCount);
      });

      // Format users
      const formattedUsers = users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        profileImage: user.profileImage || null,
        bio: user.bio || "",
        isAccountVerified: user.isAccountVerified || false,
        isVerifiedBadge: user.isVerifiedBadge || false,
        followerCount: followerCountMap.get(user._id.toString()) || 0,
      }));

      // Sort by followerCount descending
      formattedUsers.sort((a, b) => b.followerCount - a.followerCount);

      return {
        content: formattedUsers,
        hashtag: `#${normalizedHashtag}`,
        pagination: null, // No pagination for users
      };
    }

    // Map query contentType to stored content types
    const contentTypeMap = {
      post: ContentType.POST,
      write: ContentType.WRITE_POST,
      zeal: ContentType.ZEAL,
      poll: ContentType.POLL,
    };

    const allowedKeys =
      contentType === "all" ? Object.keys(contentTypeMap) : [contentType];
    const allowedLinkTypes = allowedKeys
      .map((key) => contentTypeMap[key])
      .filter(Boolean);

    if (allowedLinkTypes.length === 0) {
      return {
        content: [],
        hashtag: `#${normalizedHashtag}`,
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // Find hashtag record
    const hashtagDoc = await Hashtag.findOne({ tag: normalizedTag });
    if (!hashtagDoc) {
      return {
        content: [],
        hashtag: `#${normalizedHashtag}`,
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // Fetch content links for the hashtag
    const contentLinks = await HashtagContent.find({
      hashtagId: hashtagDoc._id,
      contentType: { $in: allowedLinkTypes },
    })
      .select("contentType contentId")
      .lean();

    if (contentLinks.length === 0) {
      return {
        content: [],
        hashtag: `#${normalizedHashtag}`,
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    const contentIdsByType = {
      [ContentType.POST]: new Set(),
      [ContentType.WRITE_POST]: new Set(),
      [ContentType.ZEAL]: new Set(),
      Poll: new Set(),
    };

    contentLinks.forEach((link) => {
      if (contentIdsByType[link.contentType]) {
        contentIdsByType[link.contentType].add(link.contentId.toString());
      }
    });

    const contentQueries = [];

    // Search Posts
    const postIds = Array.from(contentIdsByType[ContentType.POST]);
    if (postIds.length > 0) {
      const postQuery = {
        userId: { $in: validUserIds },
        _id: { $in: postIds },
      };

      if (reportedContentIds[ContentType.POST].length > 0) {
        postQuery._id.$nin = reportedContentIds[ContentType.POST].map(
          (id) => new mongoose.Types.ObjectId(id)
        );
      }

      contentQueries.push(
        Post.find(postQuery)
          .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("musicId", "title artist album coverImage duration")
          .select("-__v")
          .lean()
          .then((posts) =>
            posts.map((post) => ({
              ...post,
              contentType: ContentType.POST,
            }))
          )
      );
    }

    // Search WritePosts
    const writeIds = Array.from(contentIdsByType[ContentType.WRITE_POST]);
    if (writeIds.length > 0) {
      const writeQuery = {
        userId: { $in: validUserIds },
        _id: { $in: writeIds },
      };

      if (reportedContentIds[ContentType.WRITE_POST].length > 0) {
        writeQuery._id.$nin = reportedContentIds[ContentType.WRITE_POST].map(
          (id) => new mongoose.Types.ObjectId(id)
        );
      }

      contentQueries.push(
        WritePost.find(writeQuery)
          .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
          .select("-__v")
          .lean()
          .then((writes) =>
            writes.map((write) => ({
              ...write,
              contentType: ContentType.WRITE_POST,
            }))
          )
      );
    }

    // Search ZealPosts
    const zealIds = Array.from(contentIdsByType[ContentType.ZEAL]);
    if (zealIds.length > 0) {
      const zealQuery = {
        userId: { $in: validUserIds },
        status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
        _id: { $in: zealIds },
      };

      if (reportedContentIds[ContentType.ZEAL].length > 0) {
        zealQuery._id.$nin = reportedContentIds[ContentType.ZEAL].map(
          (id) => new mongoose.Types.ObjectId(id)
        );
      }

      contentQueries.push(
        ZealPost.find(zealQuery)
          .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
          .populate("musicId", "title artist album coverImage duration")
          .select("-__v")
          .lean()
          .then((zeals) =>
            zeals.map((zeal) => ({
              ...zeal,
              contentType: ContentType.ZEAL,
            }))
          )
      );
    }

    // Search Polls
    const pollIds = Array.from(contentIdsByType[ContentType.POLL]);
    if (pollIds.length > 0) {
      const pollQuery = {
        createdBy: { $in: validUserIds },
        // status: PollStatus.ACTIVE,
        _id: { $in: pollIds },
      };

      if (reportedContentIds[ContentType.POLL].length > 0) {
        pollQuery._id.$nin = reportedContentIds[ContentType.POLL].map(
          (id) => new mongoose.Types.ObjectId(id)
        );
      }

      contentQueries.push(
        Poll.find(pollQuery)
          .populate("createdBy", "name username profileImage isAccountVerified isVerifiedBadge")
          .select("-__v")
          .lean()
          .then((polls) =>
            polls.map((poll) => ({
              ...poll,
              contentType: ContentType.POLL,
            }))
          )
      );
    }

    const contentArrays = await Promise.all(contentQueries);
    let allContentItems = contentArrays.flat();

    if (allContentItems.length === 0) {
      return {
        content: [],
        hashtag: `#${normalizedHashtag}`,
        pagination: getPaginationMeta(0, page, limit),
      };
    }

    // Get engagement metrics for content (not polls)
    const contentItems = allContentItems.filter(
      (item) => item.contentType !== ContentType.POLL
    );
    const metricsMap = await getEngagementMetrics(contentItems);

    // Get liked and saved content IDs
    const [likedContentIds, savedContentIds] = userId
      ? await Promise.all([
          getLikedContentIds(userId, contentItems),
          getSavedContentIds(userId, contentItems),
        ])
      : [new Set(), new Set()];

    // Attach metrics and calculate scores
    const contentWithMetrics = allContentItems.map((item) => {
      if (item.contentType === ContentType.POLL) {
        return {
          ...item,
          popularityScore: item.totalVotes || 0,
        };
      }

      const metrics = metricsMap.get(item._id.toString()) || {
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
      };
      return {
        ...item,
        metrics,
        popularityScore:
          metrics.likeCount * 1 +
          metrics.commentCount * 2 +
          metrics.shareCount * 3,
      };
    });

    // Sort content
    if (sortBy === "popularity") {
      contentWithMetrics.sort((a, b) => b.popularityScore - a.popularityScore);
    } else if (sortBy === "recent") {
      contentWithMetrics.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      // Relevance: combine popularity with recency
      contentWithMetrics.sort((a, b) => {
        const now = Date.now();
        const ageA = now - new Date(a.createdAt).getTime();
        const ageB = now - new Date(b.createdAt).getTime();
        const recencyA = Math.max(0, 1 - ageA / (7 * 24 * 60 * 60 * 1000)); // 7 days
        const recencyB = Math.max(0, 1 - ageB / (7 * 24 * 60 * 60 * 1000));
        const scoreA = a.popularityScore * (1 + recencyA);
        const scoreB = b.popularityScore * (1 + recencyB);
        return scoreB - scoreA;
      });
    }

    // Apply pagination
    const total = contentWithMetrics.length;
    const paginatedContent = contentWithMetrics.slice(skip, skip + limit);

    const followedUserIdSet = await getFollowedUserIdSet(userId);

    // Format content
    const formattedContent = paginatedContent.map((item) => {
      const isFollowing = getIsFollowing(item, userId, followedUserIdSet);

      if (item.contentType === ContentType.POLL) {
        const userSelectedOptionId = getUserSelectedOptionId(item, userId);
        return {
          id: item._id.toString(),
          contentType: ContentType.POLL,
          caption: item.caption || "",
          options: addSelectedByAuthUserToOptions(
            item.options,
            userSelectedOptionId
          ),
          totalVotes: item.totalVotes || 0,
          status: item.status,
          duration: item.duration,
          createdBy: {
            id: item.createdBy._id.toString(),
            name: item.createdBy.name,
            username: item.createdBy.username,
            profileImage: item.createdBy.profileImage,
            isAccountVerified: item.createdBy.isAccountVerified,
            isVerifiedBadge: item.createdBy.isVerifiedBadge,
          },
          isFollowing,
          createdAt: item.createdAt,
        };
      }

      const isLiked = likedContentIds.has(item._id.toString());
      const isSaved = savedContentIds.has(item._id.toString());
      return formatContentItem(
        item,
        item.metrics,
        item.contentType,
        isLiked,
        isSaved,
        isFollowing
      );
    });

    return {
      content: formattedContent,
      hashtag: `#${normalizedHashtag}`,
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getContentByHashtag:", error);
    throw error;
  }
};

/**
 * Escape special regex characters for safe regex search
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Simplified Search for specific types (explore, trending, polls, users)
 * @param {mongoose.Types.ObjectId} userId - User ID (optional)
 * @param {Object} options - Search options
 * @param {string} options.query - Search query (optional)
 * @param {string} options.type - Filter by type: 'explore', 'trending', 'polls', 'users', 'hashtag'
 * @param {string} options.contentType - For explore type: 'zeal' or 'post' (optional)
 * @returns {Promise<Object>} Search results (no pagination, max 15 items)
 */
export const simplifiedSearch = async (userId = null, options = {}) => {
  try {
    const { query = "", type, contentType } = options;
    const limit = 15; // Fixed limit

    // Get blocked users and reported content if userId is provided
    let blockedUserIds = [];
    let reportedContentIds = {
      [ContentType.POLL]: [],
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
    };

    if (userId) {
      blockedUserIds = await getBlockedUserIds(userId);
      try {
        reportedContentIds = await getReportedContentIds(userId);
      } catch (error) {
        logger.error("Error getting reported content IDs:", error);
      }
    }

    // Build base user query
    const baseUserQuery = {
      isDeleted: false,
    };

    if (blockedUserIds.length > 0) {
      baseUserQuery._id = { $nin: blockedUserIds };
    }

    const validUsers = await User.find(baseUserQuery).select("_id");
    const validUserIds = validUsers.map((u) => u._id);

    const searchQuery = query.trim();
    const isHashtagQuery = searchQuery.startsWith("#");
    const searchTerm = isHashtagQuery ? searchQuery.substring(1) : searchQuery;
    // Escape regex special characters for safe search
    const safeSearchTerm = searchTerm ? escapeRegex(searchTerm) : "";

    // Handle different types
    if (type === "explore") {
      // Explore: zeals and posts
      const contentQueries = [];

      // If searching by username/name, find matching users first
      let matchingUserIds = [];
      if (safeSearchTerm && !isHashtagQuery) {
        const matchingUsers = await User.find({
          ...baseUserQuery,
          $or: [
            { name: { $regex: safeSearchTerm, $options: "i" } },
            { username: { $regex: safeSearchTerm, $options: "i" } },
          ],
        }).select("_id");
        matchingUserIds = matchingUsers.map((u) => u._id);
      }

      // Search Posts (if contentType is 'post' or not specified)
      if (!contentType || contentType === "post") {
        const postQuery = {
          userId: { $in: validUserIds },
        };

        if (reportedContentIds[ContentType.POST].length > 0) {
          postQuery._id = {
            $nin: reportedContentIds[ContentType.POST].map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          };
        }

        if (safeSearchTerm) {
          if (isHashtagQuery) {
            // Hashtag search: match hashtag with partial word support
            postQuery.caption = { $regex: `#${safeSearchTerm}`, $options: "i" };
          } else {
            // Text search: search in caption OR username/name
            // Build $or condition: caption matches OR userId is in matching users
            const orConditions = [
              { caption: { $regex: safeSearchTerm, $options: "i" } },
            ];
            if (matchingUserIds.length > 0) {
              orConditions.push({ userId: { $in: matchingUserIds } });
            }
            postQuery.$or = orConditions;
          }
        }

        contentQueries.push(
          Post.find(postQuery)
            .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("musicId", "title artist album coverImage duration")
            .select("-__v")
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .then((posts) =>
              posts.map((post) => ({
                ...post,
                contentType: ContentType.POST,
              }))
            )
        );
      }

      // Search ZealPosts (if contentType is 'zeal' or not specified)
      if (!contentType || contentType === "zeal") {
        const zealQuery = {
          userId: { $in: validUserIds },
          status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
        };

        if (reportedContentIds[ContentType.ZEAL].length > 0) {
          zealQuery._id = {
            $nin: reportedContentIds[ContentType.ZEAL].map(
              (id) => new mongoose.Types.ObjectId(id)
            ),
          };
        }

        if (safeSearchTerm) {
          if (isHashtagQuery) {
            // Hashtag search: match hashtag with partial word support
            zealQuery.caption = { $regex: `#${safeSearchTerm}`, $options: "i" };
          } else {
            // Text search: search in caption OR username/name
            // Build $or condition: caption matches OR userId is in matching users
            const orConditions = [
              { caption: { $regex: safeSearchTerm, $options: "i" } },
            ];
            if (matchingUserIds.length > 0) {
              orConditions.push({ userId: { $in: matchingUserIds } });
            }
            zealQuery.$or = orConditions;
          }
        }

        contentQueries.push(
          ZealPost.find(zealQuery)
            .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
            .populate("musicId", "title artist album coverImage duration")
            .select("-__v")
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean()
            .then((zeals) =>
              zeals.map((zeal) => ({
                ...zeal,
                contentType: ContentType.ZEAL,
              }))
            )
        );
      }

      const contentArrays = await Promise.all(contentQueries);
      let allContent = contentArrays.flat();

      // Get engagement metrics
      const metricsMap = await getEngagementMetrics(allContent);

      // Get liked and saved content IDs
      const [likedContentIds, savedContentIds] = userId
        ? await Promise.all([
            getLikedContentIds(userId, allContent),
            getSavedContentIds(userId, allContent),
          ])
        : [new Set(), new Set()];

      // Format content
      const followedUserIdSet = await getFollowedUserIdSet(userId);

      const formattedContent = allContent
        .slice(0, limit)
        .map((item) => {
          const metrics = metricsMap.get(item._id.toString()) || {
            likeCount: 0,
            commentCount: 0,
            shareCount: 0,
          };
          const isLiked = likedContentIds.has(item._id.toString());
          const isSaved = savedContentIds.has(item._id.toString());
          const isFollowing = getIsFollowing(item, userId, followedUserIdSet);

          return formatContentItem(
            item,
            metrics,
            item.contentType,
            isLiked,
            isSaved,
            isFollowing
          );
        });

      return { data: formattedContent };
    } else if (type === "trending") {
      // Trending: only write posts
      const writeQuery = {
        userId: { $in: validUserIds },
      };

      if (reportedContentIds[ContentType.WRITE_POST].length > 0) {
        writeQuery._id = {
          $nin: reportedContentIds[ContentType.WRITE_POST].map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      if (safeSearchTerm) {
        if (isHashtagQuery) {
          // Hashtag search: match hashtag with partial word support
          writeQuery.content = { $regex: `#${safeSearchTerm}`, $options: "i" };
        } else {
          // Text search: use regex for partial word matching (e.g., "h" matches "hello")
          writeQuery.content = { $regex: safeSearchTerm, $options: "i" };
        }
      }

      const writes = await WritePost.find(writeQuery)
        .populate("userId", "name username profileImage isAccountVerified isVerifiedBadge")
        .populate("mentionedUserIds", "name username profileImage isAccountVerified isVerifiedBadge")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const allContent = writes.map((write) => ({
        ...write,
        contentType: ContentType.WRITE_POST,
      }));

      // Get engagement metrics
      const metricsMap = await getEngagementMetrics(allContent);

      // Get liked and saved content IDs
      const [likedContentIds, savedContentIds] = userId
        ? await Promise.all([
            getLikedContentIds(userId, allContent),
            getSavedContentIds(userId, allContent),
          ])
        : [new Set(), new Set()];

      // Format content
      const followedUserIdSet = await getFollowedUserIdSet(userId);

      const formattedContent = allContent.map((item) => {
        const metrics = metricsMap.get(item._id.toString()) || {
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
        };
        const isLiked = likedContentIds.has(item._id.toString());
        const isSaved = savedContentIds.has(item._id.toString());
        const isFollowing = getIsFollowing(item, userId, followedUserIdSet);

        return formatContentItem(
          item,
          metrics,
          item.contentType,
          isLiked,
          isSaved,
          isFollowing
        );
      });

      return { data: formattedContent };
    } else if (type === "polls") {
      // Polls: only polls
      const pollQuery = {
        createdBy: { $in: validUserIds },
        // status: PollStatus.ACTIVE,
      };
      if (reportedContentIds[ContentType.POLL].length > 0) {
        pollQuery._id = {
          $nin: reportedContentIds[ContentType.POLL].map(
            (id) => new mongoose.Types.ObjectId(id)
          ),
        };
      }

      if (safeSearchTerm) {
        if (isHashtagQuery) {
          // Hashtag search: match hashtag with partial word support
          pollQuery.caption = { $regex: `#${safeSearchTerm}`, $options: "i" };
        } else {
          // Text search: use regex for partial word matching (e.g., "h" matches "hello")
          pollQuery.caption = { $regex: safeSearchTerm, $options: "i" };
        }
      }

      const polls = await Poll.find(pollQuery)
        .populate("createdBy", "name username profileImage isAccountVerified isVerifiedBadge")
        .select("-__v")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const followedUserIdSet = await getFollowedUserIdSet(userId);

      const formattedPolls = polls.map((poll) => {
        const userSelectedOptionId = getUserSelectedOptionId(poll, userId);
        const isFollowing = getIsFollowing(
          { createdBy: poll.createdBy },
          userId,
          followedUserIdSet
        );

        return {
          id: poll._id.toString(),
          caption: poll.caption || "",
          options: addSelectedByAuthUserToOptions(
            poll.options,
            userSelectedOptionId
          ),
          totalVotes: poll.totalVotes || 0,
          status: poll.status,
          duration: poll.duration,
          createdBy: {
            id: poll.createdBy._id.toString(),
            name: poll.createdBy.name,
            username: poll.createdBy.username,
            profileImage: poll.createdBy.profileImage,
            isAccountVerified: poll.createdBy.isAccountVerified,
            isVerifiedBadge: poll.createdBy.isVerifiedBadge,
          },
          isFollowing,
          createdAt: poll.createdAt,
        };
      });

      return { data: formattedPolls };
    } else if (type === "users") {
      // Users: query on username or name
      const userSearchQuery = {
        ...baseUserQuery,
      };

      if (safeSearchTerm) {
        userSearchQuery.$or = [
          { name: { $regex: safeSearchTerm, $options: "i" } },
          { username: { $regex: safeSearchTerm, $options: "i" } },
        ];
      }

      const users = await User.find(userSearchQuery)
        .select("name username profileImage bio isAccountVerified isVerifiedBadge followerCount")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      const followedUserIdSet = await getFollowedUserIdSet(userId);

      const formattedUsers = users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio || "",
        isAccountVerified: user.isAccountVerified,
        isVerifiedBadge: user.isVerifiedBadge,
        followerCount: user.followerCount || 0,
        isFollowing: userId
          ? followedUserIdSet.has(user._id.toString())
          : null,
      }));

      return { data: formattedUsers };
    }else if (type === "hashtag") {
  // Normalize search term (remove # if user types it)
  let hashtagSearch = safeSearchTerm;

  if (hashtagSearch && hashtagSearch.startsWith("#")) {
    hashtagSearch = hashtagSearch.substring(1);
  }

  const hashtagQuery = {};

  if (hashtagSearch) {
    hashtagQuery.tag = { $regex: hashtagSearch, $options: "i" };
  } else {
    // If no search term, return top hashtags by count
    hashtagQuery.contentCount = { $gt: 0 };
  }

  const hashtags = await Hashtag.find(hashtagQuery)
    .select("tag contentCount lastUsedAt")
    .sort({ contentCount: -1, lastUsedAt: -1 })
    .limit(limit)
    .lean();

  const formattedHashtags = hashtags.map((hashtag) => ({
    tag: `#${hashtag.tag}`,
    contentCount: hashtag.contentCount || 0,
  }));

  return { data: formattedHashtags };
}

    return { data: [] };
  } catch (error) {
    logger.error("Error in simplifiedSearch:", error);
    throw error;
  }
};

export default {
  getTrendingContent,
  searchAcrossEntities,
  getContentByHashtag,
  simplifiedSearch,
  getHomeFeed,
};

