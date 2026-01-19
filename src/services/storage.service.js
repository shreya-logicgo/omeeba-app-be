/**
 * Storage Service
 * Handles file uploads and pre-signed URL generation
 */

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "../config/env.js";
import logger from "../utils/logger.js";
import crypto from "crypto";

let s3Client = null;

/**
 * Initialize S3 client (supports both AWS S3 and DigitalOcean Spaces)
 */
const initializeS3Client = () => {
  if (s3Client) {
    return s3Client;
  }

  // Priority: DigitalOcean Spaces > AWS S3
  let accessKey, secretKey, region, bucket, endpoint;

  if (
    config.digitalOcean.accessKey &&
    config.digitalOcean.secretKey &&
    config.digitalOcean.bucketName
  ) {
    // Use DigitalOcean Spaces
    accessKey = config.digitalOcean.accessKey;
    secretKey = config.digitalOcean.secretKey;
    region = config.digitalOcean.region || "blr1";
    bucket = config.digitalOcean.bucketName;
    endpoint = config.digitalOcean.endpoint;
    logger.info("Using DigitalOcean Spaces for storage");
  } else if (config.aws.accessKeyId && config.aws.secretAccessKey) {
    // Fallback to AWS S3
    accessKey = config.aws.accessKeyId;
    secretKey = config.aws.secretAccessKey;
    region = config.aws.region;
    bucket = config.aws.s3Bucket;
    endpoint = config.aws.s3Endpoint;
    logger.info("Using AWS S3 for storage");
  } else {
    logger.warn("Storage credentials not configured. Pre-signed URLs will not work.");
    return null;
  }

  const s3Config = {
    region: region,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  };

  // Add custom endpoint if provided (for S3-compatible services like DigitalOcean Spaces)
  if (endpoint) {
    s3Config.endpoint = endpoint;
    s3Config.forcePathStyle = true; // Required for DigitalOcean Spaces
  }

  s3Client = new S3Client(s3Config);
  return s3Client;
};

/**
 * Get storage bucket name
 * @returns {string} Bucket name
 */
const getBucketName = () => {
  if (config.digitalOcean.bucketName) {
    return config.digitalOcean.bucketName;
  }
  return config.aws.s3Bucket;
};

/**
 * Generate a unique storage key for the file
 * @param {string} userId - User ID
 * @param {string} fileType - File type (video or image)
 * @param {string} mimeType - MIME type
 * @returns {string} Storage key
 */
export const generateStorageKey = (userId, fileType, mimeType) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString("hex");
  const extension = mimeType.includes("video") ? "mp4" : mimeType.split("/")[1] || "jpg";
  
  // Use DigitalOcean dirname if configured
  const dirname = config.digitalOcean.dirname || "zeals";
  return `${dirname}/${userId}/${fileType}/${timestamp}-${randomString}.${extension}`;
};

/**
 * Generate pre-signed URL for file upload
 * @param {string} storageKey - Storage key (S3 key)
 * @param {string} mimeType - MIME type of the file
 * @param {number} expiresIn - Expiration time in seconds (default: 300 = 5 minutes)
 * @returns {Promise<Object>} Pre-signed URL and headers
 */
export const generatePresignedUploadUrl = async (
  storageKey,
  mimeType,
  expiresIn = 300
) => {
  try {
    const client = initializeS3Client();

    if (!client) {
      throw new Error("S3 client not initialized. Please configure AWS credentials.");
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("Storage bucket not configured");
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
      ContentType: mimeType,
      ACL: "public-read", // Make file publicly accessible
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn });

    return {
      uploadUrl,
      headers: {
        "Content-Type": mimeType,
      },
      expiresIn,
    };
  } catch (error) {
    logger.error("Error generating pre-signed URL:", error);
    throw new Error(`Failed to generate pre-signed URL: ${error.message}`);
  }
};

/**
 * Verify if file exists in storage
 * @param {string} storageKey - Storage key (S3 key)
 * @returns {Promise<boolean>} True if file exists
 */
export const verifyFileExists = async (storageKey) => {
  try {
    const client = initializeS3Client();

    if (!client) {
      logger.warn("S3 client not initialized. Cannot verify file existence.");
      return false;
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      logger.warn("Storage bucket not configured. Cannot verify file existence.");
      return false;
    }

    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: storageKey,
    });

    await client.send(command);
    return true;
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    logger.error("Error verifying file existence:", error);
    throw new Error(`Failed to verify file existence: ${error.message}`);
  }
};

/**
 * Get public URL for a file (if bucket is public)
 * @param {string} storageKey - Storage key (S3 key)
 * @returns {string} Public URL
 */
export const getPublicUrl = (storageKey) => {
  // Priority: DigitalOcean CDN URL > DigitalOcean Endpoint > AWS S3
  if (config.digitalOcean.baseUrl) {
    // Use DigitalOcean CDN URL
    return `${config.digitalOcean.baseUrl}/${storageKey}`;
  }

  if (config.digitalOcean.endpoint && config.digitalOcean.bucketName) {
    // Use DigitalOcean Spaces endpoint
    return `${config.digitalOcean.endpoint}/${config.digitalOcean.bucketName}/${storageKey}`;
  }

  // Fallback to AWS S3
  if (config.aws.s3Bucket) {
    // If custom endpoint is configured, use it
    if (config.aws.s3Endpoint) {
      return `${config.aws.s3Endpoint}/${config.aws.s3Bucket}/${storageKey}`;
    }

    // Standard S3 URL format
    return `https://${config.aws.s3Bucket}.s3.${config.aws.region}.amazonaws.com/${storageKey}`;
  }

  return null;
};

/**
 * Initiate multipart upload
 * @param {string} storageKey - Storage key (S3 key)
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<Object>} Upload ID and storage key
 */
export const initiateMultipartUpload = async (storageKey, mimeType) => {
  try {
    const client = initializeS3Client();

    if (!client) {
      throw new Error("S3 client not initialized. Please configure storage credentials.");
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("Storage bucket not configured");
    }

    const command = new CreateMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      ContentType: mimeType,
      ACL: "public-read", // Make file publicly accessible
    });

    const response = await client.send(command);

    return {
      uploadId: response.UploadId,
      storageKey: storageKey,
    };
  } catch (error) {
    logger.error("Error initiating multipart upload:", error);
    throw new Error(`Failed to initiate multipart upload: ${error.message}`);
  }
};

/**
 * Generate pre-signed URL for uploading a chunk/part
 * @param {string} storageKey - Storage key (S3 key)
 * @param {string} uploadId - Multipart upload ID
 * @param {number} partNumber - Part number (1-indexed)
 * @param {number} expiresIn - Expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} Pre-signed URL for the chunk
 */
export const generateChunkUploadUrl = async (
  storageKey,
  uploadId,
  partNumber,
  expiresIn = 3600
) => {
  try {
    const client = initializeS3Client();

    if (!client) {
      throw new Error("S3 client not initialized. Please configure storage credentials.");
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("Storage bucket not configured");
    }

    const command = new UploadPartCommand({
      Bucket: bucketName,
      Key: storageKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn });

    return uploadUrl;
  } catch (error) {
    logger.error("Error generating chunk upload URL:", error);
    throw new Error(`Failed to generate chunk upload URL: ${error.message}`);
  }
};

/**
 * Complete multipart upload
 * @param {string} storageKey - Storage key (S3 key)
 * @param {string} uploadId - Multipart upload ID
 * @param {Array} parts - Array of parts with ETag and PartNumber
 * @returns {Promise<Object>} Complete upload response
 */
export const completeMultipartUpload = async (storageKey, uploadId, parts) => {
  try {
    const client = initializeS3Client();

    if (!client) {
      throw new Error("S3 client not initialized. Please configure storage credentials.");
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("Storage bucket not configured");
    }

    // Sort parts by part number
    const sortedParts = parts
      .map((part) => ({
        ETag: part.etag,
        PartNumber: part.partNumber,
      }))
      .sort((a, b) => a.PartNumber - b.PartNumber);

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    });

    const response = await client.send(command);

    return {
      location: response.Location,
      etag: response.ETag,
      bucket: response.Bucket,
      key: response.Key,
    };
  } catch (error) {
    logger.error("Error completing multipart upload:", error);
    throw new Error(`Failed to complete multipart upload: ${error.message}`);
  }
};

/**
 * Abort multipart upload
 * @param {string} storageKey - Storage key (S3 key)
 * @param {string} uploadId - Multipart upload ID
 * @returns {Promise<void>}
 */
export const abortMultipartUpload = async (storageKey, uploadId) => {
  try {
    const client = initializeS3Client();

    if (!client) {
      throw new Error("S3 client not initialized. Please configure storage credentials.");
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      throw new Error("Storage bucket not configured");
    }

    const command = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: storageKey,
      UploadId: uploadId,
    });

    await client.send(command);
    logger.info(`Multipart upload aborted: ${uploadId} for key: ${storageKey}`);
  } catch (error) {
    logger.error("Error aborting multipart upload:", error);
    throw new Error(`Failed to abort multipart upload: ${error.message}`);
  }
};

export default {
  generateStorageKey,
  generatePresignedUploadUrl,
  verifyFileExists,
  getPublicUrl,
  initiateMultipartUpload,
  generateChunkUploadUrl,
  completeMultipartUpload,
  abortMultipartUpload,
};

