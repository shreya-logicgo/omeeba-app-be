import SavedContent from "../models/interactions/SavedContent.js";
import Post from "../models/content/Post.js";
import WritePost from "../models/content/WritePost.js";
import ZealPost from "../models/content/ZealPost.js";
import ContentLike from "../models/interactions/ContentLike.js";
import Comment from "../models/comments/Comment.js";
import { ContentType, ZealStatus } from "../models/enums.js";
import logger from "../utils/logger.js";
import { generateShareableLink } from "../utils/shareableLink.js";

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

    // Check if user has saved this content
    const existingSave = await SavedContent.findOne({
      contentType,
      contentId,
      userId,
    });

    if (!existingSave) {
      // Not saved - return current state
      // Note: We don't check if content exists here because the user might be
      // trying to unsave already deleted content, which is fine
      return {
        action: "not_saved",
        isSaved: false,
      };
    }

    // Delete the save (even if content no longer exists - cleanup stale reference)
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

/**
 * Clean up stale saved content references (delete saved content for non-existent items)
 * @param {mongoose.Types.ObjectId} userId - User ID (optional, if not provided cleans all users)
 * @returns {Promise<Object>} Cleanup result
 */
export const cleanupStaleSavedContent = async (userId = null) => {
  try {
    const filter = userId ? { userId } : {};
    let cleanedCount = 0;

    // Process in batches to avoid memory issues
    const batchSize = 100;
    let hasMore = true;
    let skip = 0;

    while (hasMore) {
      const savedContentBatch = await SavedContent.find(filter)
        .skip(skip)
        .limit(batchSize)
        .lean();

      if (savedContentBatch.length === 0) {
        hasMore = false;
        break;
      }

      // Group by content type for efficient batch checking
      const byType = {
        [ContentType.POST]: [],
        [ContentType.WRITE_POST]: [],
        [ContentType.ZEAL]: [],
      };

      savedContentBatch.forEach((record) => {
        if (byType[record.contentType]) {
          byType[record.contentType].push({
            savedContentId: record._id,
            contentId: record.contentId,
          });
        }
      });

      // Check each type for non-existent content
      const staleIds = [];

      for (const [type, items] of Object.entries(byType)) {
        if (items.length === 0) continue;

        const contentIds = items.map((item) => item.contentId);
        let existingIds;

        switch (type) {
          case ContentType.POST:
            existingIds = new Set(
              (await Post.find({ _id: { $in: contentIds } }).select("_id").lean()).map(
                (p) => p._id.toString()
              )
            );
            break;
          case ContentType.WRITE_POST:
            existingIds = new Set(
              (
                await WritePost.find({ _id: { $in: contentIds } })
                  .select("_id")
                  .lean()
              ).map((w) => w._id.toString())
            );
            break;
          case ContentType.ZEAL:
            existingIds = new Set(
              (
                await ZealPost.find({
                  _id: { $in: contentIds },
                  status: ZealStatus.PUBLISHED,
                })
                  .select("_id")
                  .lean()
              ).map((z) => z._id.toString())
            );
            break;
          default:
            continue;
        }

        // Find stale references
        items.forEach((item) => {
          if (!existingIds.has(item.contentId.toString())) {
            staleIds.push(item.savedContentId);
          }
        });
      }

      // Delete stale saved content references
      if (staleIds.length > 0) {
        const deleteResult = await SavedContent.deleteMany({
          _id: { $in: staleIds },
        });
        cleanedCount += deleteResult.deletedCount;
      }

      skip += batchSize;
      hasMore = savedContentBatch.length === batchSize;
    }

    logger.info(`Cleaned up ${cleanedCount} stale saved content references`);
    return { cleanedCount };
  } catch (error) {
    logger.error("Error in cleanupStaleSavedContent:", error);
    throw error;
  }
};

/**
 * Get user's saved content list with pagination and filtering (optimized)
 * @param {mongoose.Types.ObjectId} userId - User ID
 * @param {Object} options - Query options
 * @param {string} options.contentType - Filter by content type ('all', 'Post', 'Write Post', 'Zeal Post')
 * @param {number} options.page - Page number
 * @param {number} options.limit - Items per page
 * @returns {Promise<Object>} - Saved content list with pagination
 */
export const getSavedContentListing = async (userId, options = {}) => {
  try {
    const { contentType = "all", page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    // Build filter for saved content
    const savedContentFilter = { userId };

    // Filter by content type if not 'all'
    if (contentType !== "all") {
      // Validate content type
      if (!Object.values(ContentType).includes(contentType)) {
        throw new Error("Invalid content type");
      }
      savedContentFilter.contentType = contentType;
    }

    // Fetch more records than needed to account for deleted content
    // Use a multiplier to ensure we get enough valid content
    const fetchLimit = Math.ceil(limit * 1.5); // Fetch 50% more to account for deleted items

    // Get saved content records with pagination
    const savedContentRecords = await SavedContent.find(savedContentFilter)
      .sort({ createdAt: -1 }) // Most recently saved first
      .skip(skip)
      .limit(fetchLimit)
      .lean();

    if (savedContentRecords.length === 0) {
      return {
        content: [],
        pagination: {
          total: 0,
          actualTotal: 0,
          page,
          limit,
        },
        staleReferencesCleaned: 0,
      };
    }

    // Group saved content by type for efficient batch queries
    const savedByType = {
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
    };

    const recordMap = new Map(); // Map contentId -> savedContentRecord for quick lookup

    savedContentRecords.forEach((record) => {
      if (savedByType[record.contentType]) {
        savedByType[record.contentType].push(record.contentId);
        recordMap.set(record.contentId.toString(), record);
      }
    });

    // Fetch actual content in parallel - only fetch what exists
    const [posts, writePosts, zealPosts] = await Promise.all([
      savedByType[ContentType.POST].length > 0
        ? Post.find({
            _id: { $in: savedByType[ContentType.POST] },
          })
            .populate(
              "userId",
              "name username profileImage isAccountVerified isVerifiedBadge"
            )
            .populate(
              "mentionedUserIds",
              "name username profileImage isAccountVerified isVerifiedBadge"
            )
            .lean()
        : [],
      savedByType[ContentType.WRITE_POST].length > 0
        ? WritePost.find({
            _id: { $in: savedByType[ContentType.WRITE_POST] },
          })
            .populate(
              "userId",
              "name username profileImage isAccountVerified isVerifiedBadge"
            )
            .populate(
              "mentionedUserIds",
              "name username profileImage isAccountVerified isVerifiedBadge"
            )
            .lean()
        : [],
      savedByType[ContentType.ZEAL].length > 0
        ? ZealPost.find({
            _id: { $in: savedByType[ContentType.ZEAL] },
            status: ZealStatus.PUBLISHED, // Only show published zeal posts
          })
            .populate(
              "userId",
              "name username profileImage isAccountVerified isVerifiedBadge"
            )
            .populate(
              "mentionedUserIds",
              "name username profileImage isAccountVerified isVerifiedBadge"
            )
            .lean()
        : [],
    ]);

    // Track stale references for cleanup
    const staleReferences = [];
    const contentMap = new Map();

    // Build content map with savedAt timestamp
    [...posts, ...writePosts, ...zealPosts].forEach((content) => {
      const savedRecord = recordMap.get(content._id.toString());
      if (savedRecord) {
        contentMap.set(content._id.toString(), {
          ...content,
          contentType: savedRecord.contentType,
          savedAt: savedRecord.createdAt,
        });
      }
    });

    // Check for stale references in the current batch
    savedContentRecords.forEach((record) => {
      if (!contentMap.has(record.contentId.toString())) {
        staleReferences.push(record._id);
      }
    });

    // Clean up stale references asynchronously (don't block the response)
    if (staleReferences.length > 0) {
      SavedContent.deleteMany({ _id: { $in: staleReferences } })
        .then((result) => {
          logger.info(
            `Cleaned up ${result.deletedCount} stale saved content references for user ${userId}`
          );
        })
        .catch((error) => {
          logger.error("Error cleaning up stale references:", error);
        });
    }

    // Reconstruct ordered list based on savedContentRecords (most recent first)
    // Filter out deleted/inaccessible content
    const orderedContent = savedContentRecords
      .map((record) => {
        return contentMap.get(record.contentId.toString()) || null;
      })
      .filter((content) => content !== null)
      .slice(0, limit); // Ensure we only return the requested limit

    // Batch fetch metadata (like counts, comment counts) for all content at once
    const contentIdsByType = {};
    orderedContent.forEach((item) => {
      if (!contentIdsByType[item.contentType]) {
        contentIdsByType[item.contentType] = [];
      }
      contentIdsByType[item.contentType].push(item._id);
    });

    // Fetch counts in parallel batches by content type
    const countPromises = [];
    for (const [type, ids] of Object.entries(contentIdsByType)) {
      if (ids.length > 0) {
        countPromises.push(
          ContentLike.aggregate([
            {
              $match: {
                contentType: type,
                contentId: { $in: ids },
              },
            },
            {
              $group: {
                _id: "$contentId",
                count: { $sum: 1 },
              },
            },
          ]).then((results) => {
            const likeCountMap = new Map();
            results.forEach((r) => {
              likeCountMap.set(r._id.toString(), r.count);
            });
            return { type, field: "likeCount", map: likeCountMap };
          }),
          Comment.aggregate([
            {
              $match: {
                contentType: type,
                contentId: { $in: ids },
              },
            },
            {
              $group: {
                _id: "$contentId",
                count: { $sum: 1 },
              },
            },
          ]).then((results) => {
            const commentCountMap = new Map();
            results.forEach((r) => {
              commentCountMap.set(r._id.toString(), r.count);
            });
            return { type, field: "commentCount", map: commentCountMap };
          })
        );
      }
    }

    const countResults = await Promise.all(countPromises);

    // Build count maps
    const likeCountMap = new Map();
    const commentCountMap = new Map();

    countResults.forEach((result) => {
      if (result.field === "likeCount") {
        result.map.forEach((count, id) => likeCountMap.set(id, count));
      } else {
        result.map.forEach((count, id) => commentCountMap.set(id, count));
      }
    });

    // Add metadata to content items
    const contentWithMetadata = orderedContent.map((item) => {
      const contentIdStr = item._id.toString();
      return {
        ...item,
        likeCount: likeCountMap.get(contentIdStr) || 0,
        commentCount: commentCountMap.get(contentIdStr) || 0,
        shareableLink: generateShareableLink(item.contentType, item._id),
      };
    });

    // Get accurate total count (this is approximate due to potential deleted content)
    // For better performance, we cache this or update it during cleanup
    const totalSavedRecords = await SavedContent.countDocuments(
      savedContentFilter
    );

    logger.info(
      `Retrieved ${contentWithMetadata.length} saved content items for user ${userId} (cleaned ${staleReferences.length} stale refs)`
    );

    return {
      content: contentWithMetadata,
      pagination: {
        total: totalSavedRecords,
        actualTotal: contentWithMetadata.length,
        page,
        limit,
      },
      staleReferencesCleaned: staleReferences.length,
    };
  } catch (error) {
    logger.error("Error in getSavedContentListing:", error);
    throw error;
  }
};

export default {
  saveContent,
  unsaveContent,
  toggleSaveContent,
  isContentSaved,
  getContentSavedStatus,
  getSavedContentListing,
  cleanupStaleSavedContent,
};

