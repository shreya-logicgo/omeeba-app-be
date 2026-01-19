/**
 * Zeal Upload Service
 * Handles server-side chunked uploads in background
 */

import fs from "fs";
import path from "path";
import { Readable } from "stream";
import ZealDraft from "../models/content/ZealDraft.js";
import { ZealStatus } from "../models/enums.js";
import {
  generateStorageKey,
  initiateMultipartUpload,
  generateChunkUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
  getPublicUrl,
} from "./storage.service.js";
import config from "../config/env.js";
// File validation functions (copied from zeal.service.js to avoid circular dependency)
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

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

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

const validateFileSize = (fileSize, fileType) => {
  const maxSize = fileType === "video" ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (fileSize > maxSize) {
    const maxSizeMB = maxSize / (1024 * 1024);
    throw new Error(
      `File size exceeds maximum limit of ${maxSizeMB}MB for ${fileType} files`
    );
  }
};
import logger from "../utils/logger.js";

// Chunk size for multipart uploads (5MB per chunk)
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

// Minimum file size to use multipart upload (10MB)
const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * Upload file with automatic chunking in background
 * @param {string} userId - User ID
 * @param {Object} file - Multer file object
 * @param {string} file.originalname - Original file name
 * @param {string} file.mimetype - MIME type
 * @param {string} file.path - Temporary file path
 * @param {number} file.size - File size in bytes
 * @returns {Promise<Object>} Draft record
 */
export const uploadFileWithChunking = async (userId, file) => {
  try {
    const { originalname, mimetype, path: tempFilePath, size } = file;

    // Determine file type
    const fileType = mimetype.startsWith("video/") ? "video" : "image";

    // Validate file type
    validateFileType(mimetype, fileType);

    // Validate file size
    validateFileSize(size, fileType);

    // Generate storage key
    const storageKey = generateStorageKey(userId, fileType, mimetype);

    // Check if we should use multipart upload
    const useMultipart = fileType === "video" && size >= MULTIPART_THRESHOLD;

    if (useMultipart) {
      // Use multipart upload with background chunking
      return await uploadFileInChunks(
        userId,
        tempFilePath,
        storageKey,
        originalname,
        fileType,
        mimetype,
        size
      );
    } else {
      // Use simple upload for small files
      return await uploadFileSimple(
        userId,
        tempFilePath,
        storageKey,
        originalname,
        fileType,
        mimetype,
        size
      );
    }
  } catch (error) {
    logger.error("Error in uploadFileWithChunking:", error);
    throw error;
  }
};

/**
 * Upload file in chunks (background processing)
 * @param {string} userId - User ID
 * @param {string} filePath - Temporary file path
 * @param {string} storageKey - Storage key
 * @param {string} fileName - File name
 * @param {string} fileType - File type
 * @param {string} mimeType - MIME type
 * @param {number} fileSize - File size
 * @returns {Promise<Object>} Draft record
 */
const uploadFileInChunks = async (
  userId,
  filePath,
  storageKey,
  fileName,
  fileType,
  mimeType,
  fileSize
) => {
  let draft = null;
  let uploadId = null;

  try {
    // Initiate multipart upload
    const multipartResult = await initiateMultipartUpload(storageKey, mimeType);
    uploadId = multipartResult.uploadId;

    // Calculate chunk information
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    // Create draft record
    draft = await ZealDraft.create({
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
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
      status: ZealStatus.DRAFT,
      isUploaded: false,
      uploadUrl: "",
      uploadedParts: [],
    });

    logger.info(
      `Multipart upload initiated: ${draft._id} for user: ${userId}, chunks: ${totalChunks}`
    );

    // Start background chunk upload
    uploadChunksInBackground(
      draft._id.toString(),
      filePath,
      storageKey,
      uploadId,
      totalChunks,
      fileSize
    ).catch((error) => {
      logger.error(`Error in background chunk upload: ${error}`);
      // Update draft status to failed
      if (draft) {
        draft.status = ZealStatus.FAILED;
        draft.save().catch((saveError) => {
          logger.error(`Error saving failed draft: ${saveError}`);
        });
      }
    });

    // Return response in same format as /zeals/start endpoint
    const expiresIn = 3600; // 1 hour for multipart
    return {
      zealDraftId: draft._id.toString(),
      uploadUrl: getPublicUrl(storageKey), // Public URL (will be available after upload completes)
      headers: {},
      expiresIn,
    };
  } catch (error) {
    // Cleanup: abort multipart upload if initiated
    if (uploadId && storageKey) {
      try {
        await abortMultipartUpload(storageKey, uploadId);
      } catch (abortError) {
        logger.error(`Error aborting multipart upload: ${abortError}`);
      }
    }

    // Cleanup: delete draft if created
    if (draft) {
      try {
        await ZealDraft.findByIdAndDelete(draft._id);
      } catch (deleteError) {
        logger.error(`Error deleting draft: ${deleteError}`);
      }
    }

    throw error;
  }
};

/**
 * Upload chunks in background (parallel processing)
 * @param {string} draftId - Draft ID
 * @param {string} filePath - Temporary file path
 * @param {string} storageKey - Storage key
 * @param {string} uploadId - Multipart upload ID
 * @param {number} totalChunks - Total number of chunks
 * @param {number} fileSize - Total file size
 */
const uploadChunksInBackground = async (
  draftId,
  filePath,
  storageKey,
  uploadId,
  totalChunks,
  fileSize
) => {
  const parts = [];
  let fileHandle = null;

  try {
    // Open file for reading
    fileHandle = await fs.promises.open(filePath, "r");

    // Upload all chunks in parallel
    const uploadPromises = [];

    for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, fileSize);
      const chunkSize = end - start;

      // Get chunk upload URL
      const chunkUploadUrl = await generateChunkUploadUrl(
        storageKey,
        uploadId,
        partNumber,
        3600
      );

      // Read chunk from file
      const buffer = Buffer.alloc(chunkSize);
      await fileHandle.read(buffer, 0, chunkSize, start);

      // Upload chunk
      const uploadPromise = uploadChunk(chunkUploadUrl, buffer, partNumber)
        .then((etag) => {
          parts.push({ partNumber, etag });
          logger.info(
            `Chunk ${partNumber}/${totalChunks} uploaded for draft: ${draftId}`
          );
        })
        .catch((error) => {
          logger.error(
            `Error uploading chunk ${partNumber} for draft ${draftId}:`,
            error
          );
          throw error;
        });

      uploadPromises.push(uploadPromise);
    }

    // Wait for all chunks to upload
    await Promise.all(uploadPromises);

    // Sort parts by part number
    parts.sort((a, b) => a.partNumber - b.partNumber);

    // Complete multipart upload
    const result = await completeMultipartUpload(storageKey, uploadId, parts);

    // Update draft status
    const draft = await ZealDraft.findById(draftId);
    if (draft) {
      draft.status = ZealStatus.DRAFT;
      draft.isUploaded = true;
      draft.uploadedAt = new Date();
      draft.uploadedParts = parts.map((part) => ({
        partNumber: part.partNumber,
        etag: part.etag,
        uploadedAt: new Date(),
      }));
      await draft.save();

      logger.info(
        `Multipart upload completed successfully for draft: ${draftId}`
      );
    }
  } catch (error) {
    logger.error(`Error in uploadChunksInBackground for draft ${draftId}:`, error);

    // Update draft status to failed
    try {
      const draft = await ZealDraft.findById(draftId);
      if (draft) {
        draft.status = ZealStatus.FAILED;
        await draft.save();
      }
    } catch (updateError) {
      logger.error(`Error updating draft status to failed: ${updateError}`);
    }

    // Abort multipart upload
    try {
      await abortMultipartUpload(storageKey, uploadId);
    } catch (abortError) {
      logger.error(`Error aborting multipart upload: ${abortError}`);
    }

    throw error;
  } finally {
    // Close file handle
    if (fileHandle) {
      await fileHandle.close();
    }

    // Delete temporary file
    try {
      await fs.promises.unlink(filePath);
    } catch (unlinkError) {
      logger.warn(`Error deleting temporary file ${filePath}:`, unlinkError);
    }
  }
};

/**
 * Upload a single chunk with retry logic
 * @param {string} uploadUrl - Pre-signed upload URL
 * @param {Buffer} chunkData - Chunk data
 * @param {number} partNumber - Part number
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} retryDelay - Initial retry delay in ms (default: 1000)
 * @returns {Promise<string>} ETag
 */
const uploadChunk = async (
  uploadUrl,
  chunkData,
  partNumber,
  maxRetries = 3,
  retryDelay = 1000
) => {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: chunkData,
        headers: {
          "Content-Type": "application/octet-stream",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Failed to upload chunk ${partNumber}: ${response.status} ${response.statusText}`
        );
      }

      // Extract ETag from response headers
      const etag = response.headers.get("ETag") || response.headers.get("etag");
      if (!etag) {
        throw new Error(`No ETag received for chunk ${partNumber}`);
      }

      if (attempt > 1) {
        logger.info(
          `Chunk ${partNumber} uploaded successfully on attempt ${attempt}`
        );
      }

      return etag;
    } catch (error) {
      lastError = error;

      // Check if error is retryable
      const isRetryable =
        error.code === "ECONNRESET" ||
        error.code === "ETIMEDOUT" ||
        error.code === "ENOTFOUND" ||
        error.name === "AbortError" ||
        error.message.includes("fetch failed") ||
        error.message.includes("network") ||
        (error.response && error.response.status >= 500);

      if (!isRetryable || attempt === maxRetries) {
        logger.error(
          `Error uploading chunk ${partNumber} (attempt ${attempt}/${maxRetries}):`,
          error
        );
        throw error;
      }

      // Calculate exponential backoff delay
      const delay = retryDelay * Math.pow(2, attempt - 1);
      logger.warn(
        `Retrying chunk ${partNumber} upload (attempt ${attempt}/${maxRetries}) after ${delay}ms...`
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  logger.error(
    `Failed to upload chunk ${partNumber} after ${maxRetries} attempts:`,
    lastError
  );
  throw lastError;
};

/**
 * Upload file using simple upload (for small files)
 * @param {string} userId - User ID
 * @param {string} filePath - Temporary file path
 * @param {string} storageKey - Storage key
 * @param {string} fileName - File name
 * @param {string} fileType - File type
 * @param {string} mimeType - MIME type
 * @param {number} fileSize - File size
 * @returns {Promise<Object>} Draft record
 */
const uploadFileSimple = async (
  userId,
  filePath,
  storageKey,
  fileName,
  fileType,
  mimeType,
  fileSize
) => {
  try {
    // Read file
    const fileBuffer = await fs.promises.readFile(filePath);

    // Upload to DigitalOcean Spaces using S3 SDK
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await getS3Client();

    if (!client) {
      throw new Error("S3 client not initialized");
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("Storage bucket not configured");
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: "public-read", // Make file publicly accessible
    });

    await client.send(command);

    // Create draft record
    const draft = await ZealDraft.create({
      userId,
      fileType,
      fileName,
      fileSize,
      mimeType,
      storageKey,
      uploadUrl: getPublicUrl(storageKey),
      expiresAt: new Date(Date.now() + 300000), // 5 minutes
      status: ZealStatus.DRAFT,
      isUploaded: true,
      uploadedAt: new Date(),
      isMultipart: false,
    });

    // Delete temporary file
    try {
      await fs.promises.unlink(filePath);
    } catch (unlinkError) {
      logger.warn(`Error deleting temporary file ${filePath}:`, unlinkError);
    }

    logger.info(`File uploaded successfully: ${draft._id} for user: ${userId}`);

    // Return response in same format as /zeals/start endpoint
    const expiresIn = 300; // 5 minutes
    return {
      zealDraftId: draft._id.toString(),
      uploadUrl: getPublicUrl(storageKey),
      headers: {},
      expiresIn,
    };
  } catch (error) {
    // Delete temporary file on error
    try {
      await fs.promises.unlink(filePath);
    } catch (unlinkError) {
      logger.warn(`Error deleting temporary file ${filePath}:`, unlinkError);
    }

    throw error;
  }
};

/**
 * Get S3 client (helper function)
 */
const getS3Client = async () => {
  const { S3Client } = await import("@aws-sdk/client-s3");

  let accessKey, secretKey, region, endpoint;

  if (
    config.digitalOcean &&
    config.digitalOcean.accessKey &&
    config.digitalOcean.secretKey &&
    config.digitalOcean.bucketName
  ) {
    accessKey = config.digitalOcean.accessKey;
    secretKey = config.digitalOcean.secretKey;
    region = config.digitalOcean.region || "blr1";
    endpoint = config.digitalOcean.endpoint;
  } else if (config.aws && config.aws.accessKeyId && config.aws.secretAccessKey) {
    accessKey = config.aws.accessKeyId;
    secretKey = config.aws.secretAccessKey;
    region = config.aws.region;
    endpoint = config.aws.s3Endpoint;
  } else {
    return null;
  }

  const s3Config = {
    region: region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  };

  if (endpoint) {
    s3Config.endpoint = endpoint;
    s3Config.forcePathStyle = true;
  }

  return new S3Client(s3Config);
};

/**
 * Get bucket name (helper function)
 */
const getBucketName = () => {
  if (config.digitalOcean && config.digitalOcean.bucketName) {
    return String(config.digitalOcean.bucketName);
  }
  if (config.aws && config.aws.s3Bucket) {
    return String(config.aws.s3Bucket);
  }
  return null;
};

export default {
  uploadFileWithChunking,
};

