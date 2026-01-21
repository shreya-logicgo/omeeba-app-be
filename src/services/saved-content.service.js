import SavedContent from "../models/interactions/SavedContent.js";
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
          status: ZealStatus.PUBLISHED, // Only allow saving published zeal posts
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
 * Save content (Post, WritePost, or ZealPost)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Save operation result with action and isSaved
 */
export const saveContent = async (userId, contentType, contentId) => {
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

    // Check if user has already saved this content
    const existingSave = await SavedContent.findOne({
      contentType,
      contentId,
      userId,
    });

    if (existingSave) {
      // Already saved - return current state
      return {
        action: "already_saved",
        isSaved: true,
      };
    }

    // Create new save (using findOneAndUpdate with upsert for atomic operation)
    // This prevents race conditions in concurrent scenarios
    const savedContent = await SavedContent.findOneAndUpdate(
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

    logger.info(
      `Content saved: ${contentType} ${contentId} by user ${userId}`
    );

    return {
      action: "saved",
      isSaved: true,
      savedContentId: savedContent._id,
    };
  } catch (error) {
    logger.error("Error in saveContent:", error);

    // Handle duplicate key error (race condition)
    if (error.code === 11000 || error.message.includes("duplicate")) {
      // Content was saved concurrently, get current state
      const existingSave = await SavedContent.findOne({
        contentType,
        contentId,
        userId,
      });

      return {
        action: "already_saved",
        isSaved: existingSave !== null,
      };
    }

    throw error;
  }
};

/**
 * Unsave content (Post, WritePost, or ZealPost)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Unsave operation result with action and isSaved
 */
export const unsaveContent = async (userId, contentType, contentId) => {
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

    // Check if user has saved this content
    const existingSave = await SavedContent.findOne({
      contentType,
      contentId,
      userId,
    });

    if (!existingSave) {
      // Not saved - return current state
      return {
        action: "not_saved",
        isSaved: false,
      };
    }

    // Delete the save
    await SavedContent.findByIdAndDelete(existingSave._id);

    logger.info(
      `Content unsaved: ${contentType} ${contentId} by user ${userId}`
    );

    return {
      action: "unsaved",
      isSaved: false,
    };
  } catch (error) {
    logger.error("Error in unsaveContent:", error);
    throw error;
  }
};

/**
 * Toggle save status (save if not saved, unsave if saved)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Toggle operation result
 */
export const toggleSaveContent = async (userId, contentType, contentId) => {
  try {
    // Check if already saved
    const existingSave = await SavedContent.findOne({
      contentType,
      contentId,
      userId,
    });

    if (existingSave) {
      return await unsaveContent(userId, contentType, contentId);
    } else {
      return await saveContent(userId, contentType, contentId);
    }
  } catch (error) {
    logger.error("Error in toggleSaveContent:", error);
    throw error;
  }
};

/**
 * Check if user has saved specific content
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<boolean>} - True if saved, false otherwise
 */
export const isContentSaved = async (userId, contentType, contentId) => {
  try {
    const savedContent = await SavedContent.findOne({
      contentType,
      contentId,
      userId,
    });

    return savedContent !== null;
  } catch (error) {
    logger.error("Error in isContentSaved:", error);
    return false;
  }
};

/**
 * Get saved status for user and content
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<Object>} - Saved status
 */
export const getContentSavedStatus = async (userId, contentType, contentId) => {
  try {
    const isSaved = await isContentSaved(userId, contentType, contentId);

    return {
      isSaved,
    };
  } catch (error) {
    logger.error("Error in getContentSavedStatus:", error);
    return {
      isSaved: false,
    };
  }
};

export default {
  saveContent,
  unsaveContent,
  toggleSaveContent,
  isContentSaved,
  getContentSavedStatus,
};

