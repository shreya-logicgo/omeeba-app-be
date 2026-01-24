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
  ChatRoom,
  SavedContent,
} from "../models/index.js";
import { ContentType, ZealStatus, PollStatus } from "../models/enums.js";
import { getReportedContentIds } from "../utils/contentFilter.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";

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

    // Get comments
    metricPromises.push(
      Comment.aggregate([
        {
          $match: {
            contentType,
            contentId: { $in: contentIds },
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
            _id: "$contentId",
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
const formatContentItem = (
  item,
  metrics,
  contentType,
  isLiked = false,
  isSaved = false
) => {
  const baseItem = {
    id: item._id.toString(),
    contentType,
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
 * Get trending content for Explore landing screen
 * @param {mongoose.Types.ObjectId} userId - User ID (optional, for filtering)
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.limit - Items per page (default: 20)
 * @param {string} options.contentType - Filter by content type: 'all', 'post', 'write', 'zeal' (default: 'all')
 * @returns {Promise<Object>} Trending content with pagination
 */
export const getTrendingContent = async (userId = null, options = {}) => {
  try {
    const {
      page = 1,
      limit = 20,
      contentType = "all", // 'all', 'post', 'write', 'zeal'
    } = options;

    const skip = (page - 1) * limit;

    // Get blocked users if userId is provided
    let blockedUserIds = [];
    let reportedContentIds = {
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
        // Continue with empty reported content if there's an error
        reportedContentIds = {
          [ContentType.POST]: [],
          [ContentType.WRITE_POST]: [],
          [ContentType.ZEAL]: [],
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
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Build content queries
    const contentQueries = [];

    // Posts query
    if (contentType === "all" || contentType === "post") {
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
    if (contentType === "all" || contentType === "zeal") {
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

    // Fetch all content in parallel
    const contentArrays = await Promise.all(contentQueries);
    let allContent = contentArrays.flat();

    if (allContent.length === 0) {
      return {
        content: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Get engagement metrics for all content
    const metricsMap = await getEngagementMetrics(allContent);

    // Get liked and saved content IDs for user (if authenticated)
    const [likedContentIds, savedContentIds] = userId
      ? await Promise.all([
          getLikedContentIds(userId, allContent),
          getSavedContentIds(userId, allContent),
        ])
      : [new Set(), new Set()];

    // Calculate trending scores and attach metrics
    const contentWithScores = allContent.map((item) => {
      const metrics = metricsMap.get(item._id.toString()) || {
        likeCount: 0,
        commentCount: 0,
        shareCount: 0,
      };
      const trendingScore = calculateTrendingScore(metrics, item.createdAt);
      return {
        ...item,
        metrics,
        trendingScore,
      };
    });

    // Sort by trending score (descending)
    contentWithScores.sort((a, b) => b.trendingScore - a.trendingScore);

    // Apply pagination
    const total = contentWithScores.length;
    const paginatedContent = contentWithScores.slice(skip, skip + limit);

    // Format content items with isLiked and isSaved status
    const formattedContent = paginatedContent.map((item) => {
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

    return {
      content: formattedContent,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error("Error in getTrendingContent:", error);
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

    const skip = (page - 1) * limit;

    if (!query || query.trim().length === 0) {
      return {
        results: {
          content: [],
          users: [],
          polls: [],
          hashtags: [],
        },
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Get blocked users and reported content if userId is provided
    let blockedUserIds = [];
    let reportedContentIds = {
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
        status: PollStatus.ACTIVE,
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
      results.polls = polls.map((poll) => ({
        id: poll._id.toString(),
        caption: poll.caption || "",
        options: poll.options || [],
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
      }));
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
          status: PollStatus.ACTIVE,
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
      pagination: {
        page,
        limit,
        total: totalResults,
        pages: Math.ceil(totalResults / limit),
        hasNext: skip + limit < totalResults,
        hasPrev: page > 1,
      },
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
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Get blocked users and reported content
    let blockedUserIds = [];
    let reportedContentIds = {
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

    // Build hashtag regex
    const hashtagRegex = new RegExp(`#${normalizedHashtag}\\b`, "i");

    const contentQueries = [];

    // Search Posts
    if (contentType === "all" || contentType === "post") {
      const postQuery = {
        userId: { $in: validUserIds },
        caption: hashtagRegex,
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

    // Search WritePosts
    if (contentType === "all" || contentType === "write") {
      const writeQuery = {
        userId: { $in: validUserIds },
        content: hashtagRegex,
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

    // Search ZealPosts
    if (contentType === "all" || contentType === "zeal") {
      const zealQuery = {
        userId: { $in: validUserIds },
        status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] },
        caption: hashtagRegex,
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

    // Search Polls
    if (contentType === "all" || contentType === "poll") {
      const pollQuery = {
        createdBy: { $in: validUserIds },
        status: PollStatus.ACTIVE,
        caption: hashtagRegex,
      };

      contentQueries.push(
        Poll.find(pollQuery)
          .populate("createdBy", "name username profileImage isAccountVerified isVerifiedBadge")
          .select("-__v")
          .lean()
          .then((polls) =>
            polls.map((poll) => ({
              ...poll,
              contentType: "Poll",
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
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }

    // Get engagement metrics for content (not polls)
    const contentItems = allContentItems.filter(
      (item) => item.contentType !== "Poll"
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
      if (item.contentType === "Poll") {
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

    // Format content
    const formattedContent = paginatedContent.map((item) => {
      if (item.contentType === "Poll") {
        return {
          id: item._id.toString(),
          contentType: "poll",
          caption: item.caption || "",
          options: item.options || [],
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
        isSaved
      );
    });

    return {
      content: formattedContent,
      hashtag: `#${normalizedHashtag}`,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
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
 * @param {string} options.type - Filter by type: 'explore', 'trending', 'polls', 'users'
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
            // Text search: use regex for partial word matching (e.g., "h" matches "hello")
            postQuery.caption = { $regex: safeSearchTerm, $options: "i" };
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
            // Text search: use regex for partial word matching (e.g., "h" matches "hello")
            zealQuery.caption = { $regex: safeSearchTerm, $options: "i" };
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
          return formatContentItem(
            item,
            metrics,
            item.contentType,
            isLiked,
            isSaved
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
      const formattedContent = allContent.map((item) => {
        const metrics = metricsMap.get(item._id.toString()) || {
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
        };
        const isLiked = likedContentIds.has(item._id.toString());
        const isSaved = savedContentIds.has(item._id.toString());
        return formatContentItem(
          item,
          metrics,
          item.contentType,
          isLiked,
          isSaved
        );
      });

      return { data: formattedContent };
    } else if (type === "polls") {
      // Polls: only polls
      const pollQuery = {
        createdBy: { $in: validUserIds },
        status: PollStatus.ACTIVE,
      };

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

      const formattedPolls = polls.map((poll) => ({
        id: poll._id.toString(),
        caption: poll.caption || "",
        options: poll.options || [],
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
      }));

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

      const formattedUsers = users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        username: user.username,
        profileImage: user.profileImage,
        bio: user.bio || "",
        isAccountVerified: user.isAccountVerified,
        isVerifiedBadge: user.isVerifiedBadge,
        followerCount: user.followerCount || 0,
      }));

      return { data: formattedUsers };
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
};

