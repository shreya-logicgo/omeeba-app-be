/**
 * Zeal Service
 * Business logic for Zeal posts
 */

import ZealDraft from "../models/content/ZealDraft.js";
import ZealPost from "../models/content/ZealPost.js";
import { ZealStatus, ContentType } from "../models/enums.js";
import {
  generateStorageKey,
  generatePresignedUploadUrl,
  verifyFileExists,
  getPublicUrl,
  initiateMultipartUpload,
  uploadBufferToStorage,
} from "./storage.service.js";
import { linkHashtagsToContent, extractHashtags } from "./hashtag.service.js";
import { generateThumbnailFromUrl } from "./thumbnail.service.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";
import { createNotification } from "./notification.service.js";
import { detectAudioCopyright, muteVideo, replaceVideoAudio } from "./zeal-audio.service.js";

// Allowed file types
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
];
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// File size limits (in bytes)
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Chunk size for multipart uploads (5MB per chunk)
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Minimum file size to use multipart upload (10MB)
const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Validate file type
 * @param {string} mimeType - MIME type
 * @param {string} fileType - Expected file type (video or image)
 * @throws {Error} If file type is invalid
 */
const validateFileType = (mimeType, fileType) => {
  if (fileType === "video") {
    if (!ALLOWED_VIDEO_TYPES.includes(mimeType)) {
      throw new Error(
        `Invalid video type. Allowed types: ${ALLOWED_VIDEO_TYPES.join(", ")}`
      );
    }
  } else if (fileType === "image") {
    if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
      throw new Error(
        `Invalid image type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(", ")}`
      );
    }
  } else {
    throw new Error("File type must be either 'video' or 'image'");
  }
};

/**
 * Validate file size
 * @param {number} fileSize - File size in bytes
 * @param {string} fileType - File type (video or image)
 * @throws {Error} If file size exceeds limit
 */
const validateFileSize = (fileSize, fileType) => {
  const maxSize = fileType === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (fileSize > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    throw new Error(
      `File size exceeds maximum limit of ${maxSizeMB}MB for ${fileType} files`
    );
  }
};

/**
 * Check upload limits for user
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 * @throws {Error} If upload limit exceeded
 */
const validateUploadLimits = async (userId) => {
  // Check for pending drafts (not uploaded yet)
  const pendingDrafts = await ZealDraft.countDocuments({
    userId,
    isUploaded: false,
    expiresAt: { $gt: new Date() },
  });

  // Maximum 5 pending uploads at a time
  const MAX_PENDING_UPLOADS = 5;
  if (pendingDrafts >= MAX_PENDING_UPLOADS) {
    throw new Error(
      `You have reached the maximum limit of ${MAX_PENDING_UPLOADS} pending uploads. Please complete or cancel existing uploads.`
    );
  }
};

/**
 * Start Zeal Upload
 * Creates a draft record and generates pre-signed upload URL
 * For large videos (>10MB), uses multipart upload
 * @param {string} userId - User ID
 * @param {Object} fileData - File data
 * @param {string} fileData.fileType - File type (video or image)
 * @param {string} fileData.fileName - File name
 * @param {number} fileData.fileSize - File size in bytes
 * @param {string} fileData.mimeType - MIME type
 * @returns {Promise<Object>} Draft record with pre-signed URL or multipart upload info
 */
export const startZealUpload = async (userId, fileData) => {
  try {
    const { fileType, fileName, fileSize, mimeType } = fileData;

    // Validate file type
    validateFileType(mimeType, fileType);

    // Validate file size
    validateFileSize(fileSize, fileType);

    // Validate upload limits
    await validateUploadLimits(userId);

    // Generate storage key
    const storageKey = generateStorageKey(userId, fileType, mimeType);

    // Check if we should use multipart upload (for videos > 10MB)
    const useMultipart =
      fileType === "video" && fileSize >= MULTIPART_THRESHOLD;

    if (useMultipart) {
      // Initiate multipart upload
      const { uploadId } = await initiateMultipartUpload(storageKey, mimeType);

      // Calculate chunk information
      const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

      // Calculate expiration time (1 hour for multipart)
      const expiresIn = 3600; // 1 hour
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      // Create draft record with multipart info
      const draft = await ZealDraft.create({
        userId,
        fileType,
        fileName,
        fileSize,
        mimeType,
        storageKey,
        uploadId,
        chunkSize: CHUNK_SIZE,
        totalChunks,
        isMultipart: true,
        expiresAt,
        status: ZealStatus.DRAFT,
        isUploaded: false,
        uploadUrl: "", // Not used for multipart
      });

      logger.info(
        `Multipart upload initiated: ${draft._id} for user: ${userId}, chunks: ${totalChunks}`
      );

      // For multipart uploads, return same format as simple upload
      // Note: This endpoint is for client-side uploads, multipart handled differently
      return {
        zealDraftId: draft._id.toString(),
        uploadUrl: "", // Not applicable for multipart via this endpoint
        headers: {},
        expiresIn,
      };
    } else {
      // Use simple upload for small files
      const expiresIn = 300; // 5 minutes
      const { uploadUrl, headers } = await generatePresignedUploadUrl(
        storageKey,
        mimeType,
        expiresIn
      );

      // Calculate expiration time
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + expiresIn);

      // Create draft record
      const draft = await ZealDraft.create({
        userId,
        fileType,
        fileName,
        fileSize,
        mimeType,
        storageKey,
        uploadUrl,
        expiresAt,
        status: ZealStatus.DRAFT,
        isUploaded: false,
        isMultipart: false,
      });

      logger.info(`Zeal draft created: ${draft._id} for user: ${userId}`);

      return {
        zealDraftId: draft._id.toString(),
        uploadUrl,
        headers: headers || {},
        expiresIn,
      };
    }
  } catch (error) {
    logger.error("Error in startZealUpload:", error);
    throw error;
  }
};


/**
 * Create Zeal Post
 * Verifies media exists in storage, creates Zeal record, and starts async processing
 * @param {string} userId - User ID
 * @param {string} zealDraftId - Draft ID
 * @param {Object} zealData - Zeal post data
 * @param {string} zealData.caption - Caption
 * @param {Array} zealData.mentionedUserIds - Mentioned user IDs
 * @param {string} zealData.musicId - Music ID (optional)
 * @param {number} zealData.musicStartTime - Music start time (optional)
 * @param {number} zealData.musicEndTime - Music end time (optional)
 * @param {boolean} zealData.isDevelopByAi - AI developed flag (optional)
 * @returns {Promise<Object>} Created Zeal post
 */
export const createZeal = async (userId, zealDraftId, zealData) => {
  try {
    // Find draft record
    const draft = await ZealDraft.findOne({
      _id: zealDraftId,
      userId,
      status: ZealStatus.DRAFT,
    });

    if (!draft) {
      throw new Error("Draft not found or already processed");
    }

    // For multipart uploads, check if upload is completed
    if (draft.isMultipart && !draft.isUploaded) {
      throw new Error(
        "Multipart upload not completed. Please complete the upload first."
      );
    }

    // Verify file exists in storage
    const fileExists = await verifyFileExists(draft.storageKey);

    if (!fileExists) {
      // Update draft status
      draft.status = ZealStatus.FAILED;
      await draft.save();

      throw new Error("File not found in storage. Please upload the file first.");
    }

    // Get public URL for the file
    const mediaUrl = getPublicUrl(draft.storageKey);

    // Create Zeal post with processing status
    const isMute = zealData.audioAction === "mute";
    const zealPost = await ZealPost.create({
      userId,
      [draft.fileType === "video" ? "videos" : "images"]: [mediaUrl],
      caption: zealData.caption || "",
      mentionedUserIds: zealData.mentionedUserIds || [],
      musicId: isMute ? null : (zealData.musicId || null),
      musicStartTime: isMute ? null : (zealData.musicStartTime || null),
      musicEndTime: isMute ? null : (zealData.musicEndTime || null),
      isDevelopByAi: zealData.isDevelopByAi || false,
      status: ZealStatus.PROCESSING,
      mediaUrl,
      audioAction: zealData.audioAction || (zealData.musicId ? "replace" : null),
    });

    // Update draft status
    draft.status = ZealStatus.PROCESSING;
    draft.isUploaded = true;
    draft.uploadedAt = new Date();
    await draft.save();

    logger.info(`Zeal post created: ${zealPost._id} for user: ${userId}`);

    // Create notifications for mentioned users
    if (zealData.mentionedUserIds && zealData.mentionedUserIds.length > 0) {
      for (const mentionedUserId of zealData.mentionedUserIds) {
        try {
          await createNotification({
            receiverId: mentionedUserId,
            senderId: userId,
            type: "MENTION_IN_ZEAL",
            contentType: ContentType.ZEAL,
            contentId: zealPost._id,
            message: zealData.caption || ""
          });
        } catch (error) {
          logger.error(`Error creating mention notification for user ${mentionedUserId}:`, error);
        }
      }
    }

    // Start async processing (in a real app, this would be a background job)
    // For now, we'll simulate processing by updating status after a delay
    processZealAsync(zealPost._id.toString()).catch((error) => {
      logger.error(`Error processing zeal ${zealPost._id}:`, error);
    });

    return zealPost;
  } catch (error) {
    logger.error("Error in createZeal:", error);
    throw error;
  }
};

/**
 * Process Zeal asynchronously
 * This simulates video/image processing
 * In production, this would be a background job (e.g., using Bull, BullMQ, or AWS SQS)
 * @param {string} zealId - Zeal post ID
 */
const processZealAsync = async (zealId) => {
  try {
    const zealPost = await ZealPost.findById(zealId);

    if (!zealPost) {
      logger.error(`Zeal post not found: ${zealId}`);
      return;
    }

    let isProcessingSuccessful = true;
    let processingError = null;

    try {
      // Generate thumbnail for videos
      if (zealPost.videos && zealPost.videos.length > 0 && zealPost.mediaUrl) {
        const videoUrl = zealPost.videos[0] || zealPost.mediaUrl;

        logger.info(`Generating thumbnail for zeal ${zealId} from video: ${videoUrl}`);

        try {
          // Generate thumbnail from video URL (1 second offset, 640px width)
          const thumbnailBuffer = await generateThumbnailFromUrl(videoUrl, {
            timeOffset: 1,
            width: 640,
          });

          // Generate storage key for thumbnail
          const thumbnailStorageKey = generateStorageKey(
            zealPost.userId.toString(),
            "thumbnail",
            "image/jpeg",
            "zeals"
          );

          // Upload thumbnail to storage
          const thumbnailUrl = await uploadBufferToStorage(
            thumbnailStorageKey,
            thumbnailBuffer,
            "image/jpeg"
          );

          // Save thumbnail URL
          zealPost.thumbnailUrl = thumbnailUrl;
          logger.info(`Thumbnail uploaded successfully for zeal ${zealId}: ${thumbnailUrl}`);

          // NEW: Audio Copyright Detection
          // NEW: Distinction between explicit choice and direct upload
          if (zealPost.videos && zealPost.videos.length > 0) {
            const hasExplicitAction = zealPost.audioAction !== null;

            if (hasExplicitAction) {
              logger.info(`Applying explicit audio action "${zealPost.audioAction}" for zeal ${zealId}`);

              try {
                let finalProcessedUrl = videoUrl;
                if (zealPost.audioAction === "mute") {
                  logger.info(`Starting mute process for zeal ${zealId}...`);
                  finalProcessedUrl = await muteVideo(videoUrl, zealPost.userId.toString());
                } else if (zealPost.audioAction === "replace") {
                  if (!zealPost.musicId) {
                    logger.error(`Music ID missing for replace action on zeal ${zealId}`);
                    throw new Error("Music ID is required for audio replacement");
                  }
                  logger.info(`Starting replace process for zeal ${zealId} with music ${zealPost.musicId}...`);
                  finalProcessedUrl = await replaceVideoAudio(
                    videoUrl, 
                    zealPost.musicId.toString(), 
                    zealPost.userId.toString(),
                    zealPost.musicStartTime,
                    zealPost.musicEndTime
                  );
                } else if (zealPost.audioAction === "original") {
                  logger.info(`User explicitly chose original audio for zeal ${zealId}`);
                  // Nothing more to do, keep original videoUrl
                }

                logger.info(`Audio action "${zealPost.audioAction}" processed successfully for zeal ${zealId}. New URL: ${finalProcessedUrl}`);

                zealPost.videos = [finalProcessedUrl];
                zealPost.mediaUrl = finalProcessedUrl;
                zealPost.status = ZealStatus.PUBLISHED;
                zealPost.audioStatus = zealPost.audioAction === "original" ? "none" : "processed";
                await zealPost.save();
                return; // Stop here, we already did what was requested
              } catch (audioActionError) {
                logger.error(`Failed to process explicit audio action for zeal ${zealId}:`, audioActionError);
                // Fallback: flag it for user check
                zealPost.status = ZealStatus.ACTION_REQUIRED;
                zealPost.processingError = `Explicit audio action failed: ${audioActionError.message}`;
                await zealPost.save();
                return;
              }
            }

            // If no explicit action (Direct Upload), run copyright detection
            logger.info(`No audio action provided for zeal ${zealId}, performing mandatory copyright detection (Direct Upload)`);
            const detection = await detectAudioCopyright(videoUrl);

            if (detection.isFlagged) {
              logger.info(`Audio flagged for zeal ${zealId}: ${detection.reason}`);

              // Direct upload + flag = ALWAYS ACTION_REQUIRED
              zealPost.status = ZealStatus.ACTION_REQUIRED;
              zealPost.audioStatus = "flagged";
              zealPost.processingError = detection.reason;
              await zealPost.save();
              return;
            } else {
              zealPost.audioStatus = "ok";
            }
          }
        } catch (thumbnailError) {
          logger.error(`Error generating thumbnail for zeal ${zealId}:`, thumbnailError);
          // Don't fail the whole processing if thumbnail generation fails
          // Continue without thumbnail
          processingError = `Thumbnail generation failed: ${thumbnailError.message}`;
        }
      }

      // Additional processing can be added here:
      // - Video transcoding
      // - Image optimization
      // - Format validation
      // etc.

    } catch (processingErr) {
      logger.error(`Processing error for zeal ${zealId}:`, processingErr);
      isProcessingSuccessful = false;
      processingError = `Processing failed: ${processingErr.message}`;
    }

    if (isProcessingSuccessful) {
      zealPost.status = ZealStatus.PUBLISHED;
      zealPost.processingError = processingError; // May contain thumbnail warning
      logger.info(`Zeal post processed successfully: ${zealId}`);

      await zealPost.save();

      // Link hashtags to content when status becomes READY (async, don't wait)
      if (zealPost.caption) {
        const tags = extractHashtags(zealPost.caption);
        if (tags.length > 0) {
          linkHashtagsToContent(ContentType.ZEAL, zealPost._id, tags).catch(
            (error) => {
              logger.error(`Error linking hashtags for zeal ${zealPost._id}:`, error);
            }
          );
        }
      }
    } else {
      zealPost.status = ZealStatus.FAILED;
      zealPost.processingError = "Processing failed: Unsupported format or corrupted file";
      logger.error(`Zeal post processing failed: ${zealId}`);
      await zealPost.save();
    }
  } catch (error) {
    logger.error(`Error in processZealAsync for ${zealId}:`, error);

    // Update status to failed
    try {
      const zealPost = await ZealPost.findById(zealId);
      if (zealPost) {
        zealPost.status = ZealStatus.FAILED;
        zealPost.processingError = `Processing error: ${error.message}`;
        await zealPost.save();
      }
    } catch (updateError) {
      logger.error(`Error updating zeal status to failed: ${updateError}`);
    }
  }
};

/**
 * Get Zeal Status
 * @param {string} userId - User ID
 * @param {string} zealId - Zeal post ID
 * @returns {Promise<Object>} Zeal post status
 */
export const getZealStatus = async (userId, zealId) => {
  try {
    // 1. Try to find Zeal Post
    const zealPost = await ZealPost.findOne({
      _id: zealId,
      userId,
    });

    if (zealPost) {
      return {
        zealId: zealPost._id.toString(),
        status: zealPost.status,
        processingError: zealPost.processingError,
        isUploaded: true,
        createdAt: zealPost.createdAt,
        updatedAt: zealPost.updatedAt,
        type: "post",
      };
    }

    // 2. If not found, try to find Zeal Draft
    const zealDraft = await ZealDraft.findOne({
      _id: zealId,
      userId,
    });

    if (zealDraft) {
      return {
        zealId: zealDraft._id.toString(),
        status: zealDraft.status, // draft, failed
        isUploaded: zealDraft.isUploaded,
        uploadedParts: zealDraft.uploadedParts ? zealDraft.uploadedParts.length : 0,
        totalChunks: zealDraft.totalChunks,
        createdAt: zealDraft.createdAt,
        updatedAt: zealDraft.updatedAt,
        type: "draft",
      };
    }

    throw new Error("Zeal not found");
  } catch (error) {
    logger.error("Error in getZealStatus:", error);
    throw error;
  }
};

/**
 * Handle user decision for flagged audio
 * @param {string} userId - User ID
 * @param {string} zealId - Zeal ID
 * @param {string} action - Action to take (use_original, mute, replace)
 * @param {string} musicId - Music ID (required for 'replace' action)
 * @param {number} musicStartTime - Start time in seconds
 * @param {number} musicEndTime - End time in seconds
 * @returns {Promise<Object>} Updated Zeal post
 */
export const handleZealAudioAction = async (userId, zealId, action, musicId = null, musicStartTime = null, musicEndTime = null) => {
  try {
    const zealPost = await ZealPost.findOne({ _id: zealId, userId });
    if (!zealPost) throw new Error("Zeal not found");

    if (zealPost.status !== ZealStatus.ACTION_REQUIRED) {
      throw new Error(`Invalid state: Zeal is in ${zealPost.status} status`);
    }

    const videoUrl = zealPost.videos[0] || zealPost.mediaUrl;
    if (!videoUrl) throw new Error("Video URL not found");

    // Set back to processing
    zealPost.status = ZealStatus.PROCESSING;
    zealPost.processingError = null;
    await zealPost.save();

    // Process in background
    (async () => {
      try {
        let finalVideoUrl = videoUrl;

        if (action === "mute") {
          logger.info(`Muting video for zeal ${zealId}`);
          finalVideoUrl = await muteVideo(videoUrl, userId);
        } else if (action === "replace") {
          if (!musicId) throw new Error("Music ID is required for replacement");
          logger.info(`Replacing audio for zeal ${zealId} with music ${musicId}`);
          finalVideoUrl = await replaceVideoAudio(
            videoUrl, 
            musicId, 
            userId,
            musicStartTime,
            musicEndTime
          );
        } else if (action === "original") {
          logger.info(`Using original audio for zeal ${zealId}`);
          // Already have original URL
        } else {
          throw new Error("Invalid action provided");
        }

        // Update post with user's choices and final result
        const isMute = action === "mute";
        zealPost.musicId = isMute ? null : (musicId || zealPost.musicId);
        zealPost.musicStartTime = isMute ? null : (musicStartTime !== null ? musicStartTime : zealPost.musicStartTime);
        zealPost.musicEndTime = isMute ? null : (musicEndTime !== null ? musicEndTime : zealPost.musicEndTime);
        zealPost.audioAction = action;
        
        zealPost.videos = [finalVideoUrl];
        zealPost.mediaUrl = finalVideoUrl;
        zealPost.status = ZealStatus.PUBLISHED;
        zealPost.audioStatus = action === "original" ? "none" : "processed";
        await zealPost.save();

        logger.info(`Zeal ${zealId} processed after audio action: ${action}`);
 
         // Link hashtags when finally published
         if (zealPost.caption) {
           const tags = extractHashtags(zealPost.caption);
           if (tags.length > 0) {
             linkHashtagsToContent(ContentType.ZEAL, zealPost._id, tags).catch(
               (error) => {
                 logger.error(`Error linking hashtags for zeal ${zealPost._id}:`, error);
               }
             );
           }
         }
      } catch (error) {
        logger.error(`Error processing audio action for zeal ${zealId}:`, error);
        zealPost.status = ZealStatus.FAILED;
        zealPost.processingError = `Failed to process audio action: ${error.message}`;
        await zealPost.save();
      }
    })();

    return zealPost;
  } catch (error) {
    logger.error("Error in handleZealAudioAction:", error);
    throw error;
  }
};

export default {
  startZealUpload,
  createZeal,
  getZealStatus,
  handleZealAudioAction,
};
