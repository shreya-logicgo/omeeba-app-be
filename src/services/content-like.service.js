import ContentLike from "../models/interactions/ContentLike.js";
import Post from "../models/content/Post.js";
import WritePost from "../models/content/WritePost.js";
import ZealPost from "../models/content/ZealPost.js";
import Poll from "../models/content/Poll.js";
import { ContentType, ZealStatus, PollStatus, NotificationType } from "../models/enums.js";
import { createNotification } from "./notification.service.js";
import logger from "../utils/logger.js";
import { UserFollower } from "../models/index.js";

/**
 * Verify content exists and is accessible
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post, Poll)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object|null>} - Content document or null
 */
const verifyContentExists = async (contentType, contentId) => {
  try {
    let content = null;

    switch (contentType) {
      case ContentType.POST:
        content = await Post.findById(contentId);
        break;
      case ContentType.WRITE_POST:
        content = await WritePost.findById(contentId);
        break;
      case ContentType.ZEAL:
        content = await ZealPost.findOne({
          _id: contentId,
          status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] }, // Allow likes on published or ready zeal posts
        });
        break;
      case ContentType.POLL:
        content = await Poll.findOne({
          _id: contentId,
          // status: PollStatus.ACTIVE, // Only allow likes on active polls
        });
        break;
      default:
        return null;
    }

    return content;
  } catch (error) {
    logger.error("Error verifying content exists:", error);
    return null;
  }
};

/**
 * Like content (Post, WritePost, ZealPost, or Poll)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post, Poll)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Like operation result with action and likeCount
 */
export const likeContent = async (userId, contentType, contentId) => {
  try {
    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      throw new Error("Invalid content type");
    }

    // Verify content exists and is accessible
    const content = await verifyContentExists(contentType, contentId);
    if (!content) {
      throw new Error("Content not found or not accessible");
    }

    // Check if user has already liked this content
    const existingLike = await ContentLike.findOne({
      contentType,
      contentId,
      userId,
    });

    if (existingLike) {
      // Already liked - return current state
      const likeCount = await ContentLike.countDocuments({
        contentType,
        contentId,
      });

      return {
        action: "already_liked",
        isLiked: true,
        likeCount,
      };
    }

    // Create new like (using findOneAndUpdate with upsert for atomic operation)
    // This prevents race conditions in concurrent scenarios
    const like = await ContentLike.findOneAndUpdate(
      {
        contentType,
        contentId,
        userId,
      },
      {
        contentType,
        contentId,
        userId,
        createdAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Get updated like count
    const likeCount = await ContentLike.countDocuments({
      contentType,
      contentId,
    });

    // Create notification for content owner (if not self-like)
    try {
      // Poll uses 'createdBy' instead of 'userId'
      const contentOwnerRaw = content.userId || content.createdBy;

      const contentOwnerId =
        typeof contentOwnerRaw === "object"
          ? contentOwnerRaw._id
          : contentOwnerRaw;

      if (contentOwnerId.toString() !== userId.toString()) {
        let notificationType;
        if (contentType === ContentType.POST) {
          notificationType = NotificationType.POST_LIKED;
        } else if (contentType === ContentType.ZEAL) {
          notificationType = NotificationType.ZEAL_LIKED;
        } else if (contentType === ContentType.WRITE_POST) {
          notificationType = NotificationType.WRITE_LIKED;
        } else if (contentType === ContentType.POLL) {
          notificationType = NotificationType.POLL_LIKED;
        }

        if (notificationType) {
          await createNotification({
            receiverId: contentOwnerId,
            senderId: userId,
            type: notificationType,
            contentType,
            contentId,
          });
        }
      }
    } catch (notificationError) {
      // Log error but don't fail the like operation
      logger.error("Error creating like notification:", notificationError);
    }

    logger.info(
      `Content liked: ${contentType} ${contentId} by user ${userId}`
    );

    return {
      action: "liked",
      isLiked: true,
      likeCount,
      likeId: like._id,
    };
  } catch (error) {
    logger.error("Error in likeContent:", error);

    // Handle duplicate key error (race condition)
    if (error.code === 11000 || error.message.includes("duplicate")) {
      // Content was liked concurrently, get current state
      const likeCount = await ContentLike.countDocuments({
        contentType,
        contentId,
      });

      const existingLike = await ContentLike.findOne({
        contentType,
        contentId,
        userId,
      });

      return {
        action: "already_liked",
        isLiked: existingLike !== null,
        likeCount,
      };
    }

    throw error;
  }
};

/**
 * Unlike content (Post, WritePost, ZealPost, or Poll)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post, Poll)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Unlike operation result with action and likeCount
 */
export const unlikeContent = async (userId, contentType, contentId) => {
  try {
    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      throw new Error("Invalid content type");
    }

    // Verify content exists
    const content = await verifyContentExists(contentType, contentId);
    if (!content) {
      throw new Error("Content not found or not accessible");
    }

    // Check if user has liked this content
    const existingLike = await ContentLike.findOne({
      contentType,
      contentId,
      userId,
    });

    if (!existingLike) {
      // Not liked - return current state
      const likeCount = await ContentLike.countDocuments({
        contentType,
        contentId,
      });

      return {
        action: "not_liked",
        isLiked: false,
        likeCount,
      };
    }

    // Delete the like
    await ContentLike.findByIdAndDelete(existingLike._id);

    // Get updated like count
    const likeCount = await ContentLike.countDocuments({
      contentType,
      contentId,
    });

    logger.info(
      `Content unliked: ${contentType} ${contentId} by user ${userId}`
    );

    return {
      action: "unliked",
      isLiked: false,
      likeCount,
    };
  } catch (error) {
    logger.error("Error in unlikeContent:", error);
    throw error;
  }
};

/**
 * Toggle like status (like if not liked, unlike if liked)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post, Poll)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Toggle operation result
 */
export const toggleLikeContent = async (userId, contentType, contentId) => {
  try {
    // Check if already liked
    const existingLike = await ContentLike.findOne({
      contentType,
      contentId,
      userId,
    });

    if (existingLike) {
      return await unlikeContent(userId, contentType, contentId);
    } else {
      return await likeContent(userId, contentType, contentId);
    }
  } catch (error) {
    logger.error("Error in toggleLikeContent:", error);
    throw error;
  }
};

/**
 * Check if user has liked specific content
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<boolean>} - True if liked, false otherwise
 */
export const isContentLiked = async (userId, contentType, contentId) => {
  try {
    const like = await ContentLike.findOne({
      contentType,
      contentId,
      userId,
    });

    return like !== null;
  } catch (error) {
    logger.error("Error in isContentLiked:", error);
    return false;
  }
};

/**
 * Get like count for content
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<number>} - Like count
 */
export const getContentLikeCount = async (contentType, contentId) => {
  try {
    return await ContentLike.countDocuments({
      contentType,
      contentId,
    });
  } catch (error) {
    logger.error("Error in getContentLikeCount:", error);
    return 0;
  }
};

/**
 * Get like status and count for user and content
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Like status and count
 */
export const getContentLikeStatus = async (userId, contentType, contentId) => {
  try {
    const [isLiked, likeCount] = await Promise.all([
      isContentLiked(userId, contentType, contentId),
      getContentLikeCount(contentType, contentId),
    ]);

    return {
      isLiked,
      likeCount,
    };
  } catch (error) {
    logger.error("Error in getContentLikeStatus:", error);
    return {
      isLiked: false,
      likeCount: 0,
    };
  }
};

/**
 * Get users who liked a content + follow status
 */
export const getContentLikedUsers = async (
  contentType,
  contentId,
  currentUserId,
  { page = 1, limit = 20 } = {}
) => {
  try {
    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      throw new Error("Invalid content type");
    }

    const skip = (page - 1) * limit;

    // 1. Fetch likes (paginated)
    const likes = await ContentLike.find({
      contentType,
      contentId,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name username profileImage coverImage bio")
      .lean();

    // 2. Remove null users (safety)
    const validLikes = likes.filter(like => like.userId);

    // 3. Extract user IDs
    const likedUserIds = validLikes.map(like => like.userId._id);

    // 4. Fetch follow relationships (single query)
    const followingDocs = await UserFollower.find({
      followerId: currentUserId,
      userId: { $in: likedUserIds },
    }).lean();

    // 5. Fast lookup set
    const followingSet = new Set(
      followingDocs.map(f => f.userId.toString())
    );

    // 6. Build response
    const users = validLikes.map(like => {
      const user = like.userId;
      const userIdStr = user._id.toString();
      const isSelf = userIdStr === currentUserId.toString();

      return {
        id: user._id,
        name: user.name,
        username: user.username,
        bio: user.bio,
        profileImage: user.profileImage || null,
        coverImage: user.coverImage || null,
        isFollowing: isSelf ? false : followingSet.has(userIdStr),
        isSelf: isSelf, // always present (true/false)
      };
    });

    // 7. Optional: show followed users first
    users.sort((a, b) => b.isFollowing - a.isFollowing);

    // 8. Total count
    const total = await ContentLike.countDocuments({
      contentType,
      contentId,
    });

    // 9. Final response
    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext : page * limit < total,
        hasPrev : page > 1,
      },
    };
  } catch (error) {
    logger.error("getContentLikedUsers error:", error);
    throw error;
  }
};

export default {
  likeContent,
  unlikeContent,
  toggleLikeContent,
  isContentLiked,
  getContentLikeCount,
  getContentLikeStatus,
  getContentLikedUsers,
};

