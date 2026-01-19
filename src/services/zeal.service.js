/**
 * Zeal Service
 * Business logic for Zeal posts
 */

import ZealDraft from "../models/content/ZealDraft.js";
import ZealPost from "../models/content/ZealPost.js";
import { ZealStatus } from "../models/enums.js";
import {
  generateStorageKey,
  generatePresignedUploadUrl,
  verifyFileExists,
  getPublicUrl,
  initiateMultipartUpload,
} from "./storage.service.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";

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
    const zealPost = await ZealPost.create({
      userId,
      [draft.fileType === "video" ? "videos" : "images"]: [mediaUrl],
      caption: zealData.caption || "",
      mentionedUserIds: zealData.mentionedUserIds || [],
      musicId: zealData.musicId || null,
      musicStartTime: zealData.musicStartTime || null,
      musicEndTime: zealData.musicEndTime || null,
      isDevelopByAi: zealData.isDevelopByAi || false,
      status: ZealStatus.PROCESSING,
      mediaUrl,
    });

    // Update draft status
    draft.status = ZealStatus.PROCESSING;
    draft.isUploaded = true;
    draft.uploadedAt = new Date();
    await draft.save();

    logger.info(`Zeal post created: ${zealPost._id} for user: ${userId}`);

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
    // Simulate processing delay (in production, this would be actual video/image processing)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const zealPost = await ZealPost.findById(zealId);

    if (!zealPost) {
      logger.error(`Zeal post not found: ${zealId}`);
      return;
    }

    // Simulate processing - check if file is valid
    // In production, you would:
    // 1. Download file from storage
    // 2. Validate file format
    // 3. Generate thumbnails (for videos)
    // 4. Transcode videos if needed
    // 5. Upload processed files
    // 6. Update status to READY or FAILED

    // For now, we'll just mark it as ready
    // In production, you'd check for actual processing errors
    const isProcessingSuccessful = true; // This would be determined by actual processing

    if (isProcessingSuccessful) {
      zealPost.status = ZealStatus.READY;
      zealPost.processingError = null;
      logger.info(`Zeal post processed successfully: ${zealId}`);
    } else {
      zealPost.status = ZealStatus.FAILED;
      zealPost.processingError = "Processing failed: Unsupported format or corrupted file";
      logger.error(`Zeal post processing failed: ${zealId}`);
    }

    await zealPost.save();
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
    const zealPost = await ZealPost.findOne({
      _id: zealId,
      userId,
    });

    if (!zealPost) {
      throw new Error("Zeal post not found");
    }

    return {
      zealId: zealPost._id.toString(),
      status: zealPost.status,
      processingError: zealPost.processingError,
      createdAt: zealPost.createdAt,
      updatedAt: zealPost.updatedAt,
    };
  } catch (error) {
    logger.error("Error in getZealStatus:", error);
    throw error;
  }
};

export default {
  startZealUpload,
  createZeal,
  getZealStatus,
};

