/**
 * Hashtag Service
 * Manages hashtag extraction, linking, and tracking
 */

import Hashtag from "../models/hashtags/Hashtag.js";
import HashtagContent from "../models/hashtags/HashtagContent.js";
import logger from "../utils/logger.js";

/**
 * Extract hashtags from text
 * @param {string} text - Text to extract hashtags from
 * @returns {Array<string>} Array of hashtag tags (without #, lowercase)
 */
export const extractHashtags = (text) => {
  if (!text || typeof text !== "string") {
    return [];
  }

  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex);
  
  if (!matches) {
    return [];
  }

  // Extract unique hashtags, remove # and convert to lowercase
  const hashtags = [...new Set(matches.map((tag) => tag.substring(1).toLowerCase()))];
  return hashtags;
};

/**
 * Get or create hashtag records
 * @param {Array<string>} tags - Array of hashtag tags (without #)
 * @returns {Promise<Array<mongoose.Types.ObjectId>>} Array of hashtag IDs
 */
const getOrCreateHashtags = async (tags) => {
  if (!tags || tags.length === 0) {
    return [];
  }

  const hashtagIds = [];
  const now = new Date();

  for (const tag of tags) {
    try {
      // Try to find existing hashtag
      let hashtag = await Hashtag.findOne({ tag });

      if (!hashtag) {
        // Create new hashtag
        hashtag = await Hashtag.create({
          tag,
          contentCount: 0,
          lastUsedAt: now,
        });
        logger.info(`New hashtag created: ${tag}`);
      } else {
        // Update lastUsedAt
        hashtag.lastUsedAt = now;
        await hashtag.save();
      }

      hashtagIds.push(hashtag._id);
    } catch (error) {
      logger.error(`Error processing hashtag ${tag}:`, error);
      // Continue with other hashtags even if one fails
    }
  }

  return hashtagIds;
};

/**
 * Link hashtags to content
 * @param {string} contentType - Content type (ContentType.POST, ContentType.WRITE_POST, ContentType.ZEAL, Poll)
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @param {Array<string>} tags - Array of hashtag tags (without #)
 * @returns {Promise<void>}
 */
export const linkHashtagsToContent = async (contentType, contentId, tags) => {
  try {
    if (!tags || tags.length === 0) {
      return;
    }

    // Get or create hashtags
    const hashtagIds = await getOrCreateHashtags(tags);

    if (hashtagIds.length === 0) {
      return;
    }

    // Link hashtags to content
    const linkPromises = hashtagIds.map(async (hashtagId) => {
      try {
        // Check if link already exists
        const existingLink = await HashtagContent.findOne({
          hashtagId,
          contentType,
          contentId,
        });

        if (!existingLink) {
          // Create new link
          await HashtagContent.create({
            hashtagId,
            contentType,
            contentId,
          });

          // Increment content count for hashtag
          await Hashtag.findByIdAndUpdate(hashtagId, {
            $inc: { contentCount: 1 },
            $set: { lastUsedAt: new Date() },
          });
        } else {
          // Link already exists, just update lastUsedAt
          await Hashtag.findByIdAndUpdate(hashtagId, {
            $set: { lastUsedAt: new Date() },
          });
        }
      } catch (error) {
        // Ignore duplicate key errors (already linked)
        if (error.code !== 11000) {
          logger.error(`Error linking hashtag ${hashtagId} to content:`, error);
        }
      }
    });

    await Promise.all(linkPromises);
    logger.info(`Linked ${hashtagIds.length} hashtags to ${contentType} ${contentId}`);
  } catch (error) {
    logger.error("Error in linkHashtagsToContent:", error);
    throw error;
  }
};

/**
 * Unlink hashtags from content
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<void>}
 */
export const unlinkHashtagsFromContent = async (contentType, contentId) => {
  try {
    // Find all hashtag links for this content
    const hashtagLinks = await HashtagContent.find({
      contentType,
      contentId,
    });

    if (hashtagLinks.length === 0) {
      return;
    }

    // Get unique hashtag IDs
    const hashtagIds = [...new Set(hashtagLinks.map((link) => link.hashtagId))];

    // Delete all links
    await HashtagContent.deleteMany({
      contentType,
      contentId,
    });

    // Decrement content count for each hashtag
    const updatePromises = hashtagIds.map(async (hashtagId) => {
      try {
        const hashtag = await Hashtag.findById(hashtagId);
        if (hashtag && hashtag.contentCount > 0) {
          hashtag.contentCount -= 1;
          await hashtag.save();
        }
      } catch (error) {
        logger.error(`Error updating hashtag ${hashtagId}:`, error);
      }
    });

    await Promise.all(updatePromises);
    logger.info(`Unlinked hashtags from ${contentType} ${contentId}`);
  } catch (error) {
    logger.error("Error in unlinkHashtagsFromContent:", error);
    throw error;
  }
};

/**
 * Update hashtags for content (unlink old, link new)
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @param {string} text - New text content (caption or content)
 * @returns {Promise<void>}
 */
export const updateContentHashtags = async (contentType, contentId, text) => {
  try {
    // First, unlink existing hashtags
    await unlinkHashtagsFromContent(contentType, contentId);

    // Extract new hashtags from text
    const tags = extractHashtags(text);

    // Link new hashtags
    if (tags.length > 0) {
      await linkHashtagsToContent(contentType, contentId, tags);
    }
  } catch (error) {
    logger.error("Error in updateContentHashtags:", error);
    throw error;
  }
};

/**
 * Get trending hashtags
 * @param {number} limit - Number of hashtags to return (default: 10)
 * @returns {Promise<Array>} Array of trending hashtags with content count
 */
export const getTrendingHashtags = async (limit = 10) => {
  try {
    const hashtags = await Hashtag.find({ contentCount: { $gt: 0 } })
      .sort({ contentCount: -1, lastUsedAt: -1 })
      .limit(limit)
      .select("tag contentCount lastUsedAt")
      .lean();

    return hashtags.map((hashtag) => ({
      tag: `#${hashtag.tag}`,
      contentCount: hashtag.contentCount,
      lastUsedAt: hashtag.lastUsedAt,
    }));
  } catch (error) {
    logger.error("Error in getTrendingHashtags:", error);
    throw error;
  }
};

/**
 * Get content IDs by hashtag
 * @param {string} tag - Hashtag tag (with or without #)
 * @param {string} contentType - Optional content type filter
 * @param {number} limit - Limit results
 * @returns {Promise<Array>} Array of content IDs
 */
export const getContentByHashtag = async (tag, contentType = null, limit = 100) => {
  try {
    // Normalize tag (remove # if present, lowercase)
    const normalizedTag = tag.startsWith("#") ? tag.substring(1).toLowerCase() : tag.toLowerCase();

    // Find hashtag
    const hashtag = await Hashtag.findOne({ tag: normalizedTag });
    if (!hashtag) {
      return [];
    }

    // Build query
    const query = { hashtagId: hashtag._id };
    if (contentType) {
      query.contentType = contentType;
    }

    // Get content links
    const links = await HashtagContent.find(query)
      .select("contentType contentId")
      .limit(limit)
      .lean();

    return links;
  } catch (error) {
    logger.error("Error in getContentByHashtag:", error);
    throw error;
  }
};

export default {
  extractHashtags,
  linkHashtagsToContent,
  unlinkHashtagsFromContent,
  updateContentHashtags,
  getTrendingHashtags,
  getContentByHashtag,
};

