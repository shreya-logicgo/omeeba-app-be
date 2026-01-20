import ContentLike from "../models/interactions/ContentLike.js";
import Post from "../models/content/Post.js";
import WritePost from "../models/content/WritePost.js";
import ZealPost from "../models/content/ZealPost.js";
import { ContentType, ZealStatus } from "../models/enums.js";
import logger from "../utils/logger.js";

/**
 * Verify content exists and is accessible
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
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
          status: ZealStatus.PUBLISHED, // Only allow likes on published zeal posts
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
 * Like content (Post, WritePost, or ZealPost)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
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
 * Unlike content (Post, WritePost, or ZealPost)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
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
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
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

export default {
  likeContent,
  unlikeContent,
  toggleLikeContent,
  isContentLiked,
  getContentLikeCount,
  getContentLikeStatus,
};

