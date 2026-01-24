/**
 * Snap Service
 * Business logic for snap operations
 */

import Snap from "../models/chat/Snap.js";
import { User } from "../models/index.js";
import { getMediaForUser } from "./media.service.js";
import {
  generateStorageKey,
  generatePresignedUploadUrl,
  verifyFileExists,
  getPublicUrl,
} from "./storage.service.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "../config/env.js";
import logger from "../utils/logger.js";
import { S3Client } from "@aws-sdk/client-s3";
import crypto from "crypto";

// Initialize S3 client for generating view URLs
let s3Client = null;
const initializeS3Client = () => {
  if (s3Client) return s3Client;

  let accessKey, secretKey, region, endpoint;

  if (
    config.digitalOcean.accessKey &&
    config.digitalOcean.secretKey &&
    config.digitalOcean.bucketName
  ) {
    accessKey = config.digitalOcean.accessKey;
    secretKey = config.digitalOcean.secretKey;
    region = config.digitalOcean.region || "blr1";
    endpoint = config.digitalOcean.endpoint;
  } else if (config.aws.accessKeyId && config.aws.secretAccessKey) {
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

  s3Client = new S3Client(s3Config);
  return s3Client;
};

const getBucketName = () => {
  if (config.digitalOcean.bucketName) {
    return config.digitalOcean.bucketName;
  }
  return config.aws.s3Bucket;
};

/**
 * Validate recipients
 * @param {string} senderId - Sender user ID
 * @param {Array<string>} recipientIds - Array of recipient user IDs
 * @returns {Promise<Array>} Validated recipient users
 */
const validateRecipients = async (senderId, recipientIds) => {
  if (!recipientIds || recipientIds.length === 0) {
    throw new Error("At least one recipient is required");
  }

  // Remove duplicates
  const uniqueRecipientIds = [...new Set(recipientIds)];

  // Check if sender is trying to send to themselves
  if (uniqueRecipientIds.includes(senderId)) {
    throw new Error("Cannot send snap to yourself");
  }

  // Validate maximum recipients (prevent spam)
  const MAX_RECIPIENTS = 50;
  if (uniqueRecipientIds.length > MAX_RECIPIENTS) {
    throw new Error(`Maximum ${MAX_RECIPIENTS} recipients allowed`);
  }

  // Verify all recipients exist
  const recipients = await User.find({
    _id: { $in: uniqueRecipientIds },
  }).select("_id name username");

  if (recipients.length !== uniqueRecipientIds.length) {
    throw new Error("One or more recipients not found");
  }

  return recipients;
};

/**
 * Send snap using mediaId (from POST /media/upload). Socket-only flow.
 * @param {string} senderId - Sender user ID
 * @param {Object} payload - { mediaId, recipientIds, expiresInSeconds?, duration? }
 * @returns {Promise<Object>} Formatted snap
 */
export const sendSnapWithMediaId = async (senderId, payload) => {
  const { mediaId, recipientIds, expiresInSeconds = 86400, duration = null } = payload;
  if (!mediaId || !recipientIds?.length) {
    throw new Error("mediaId and recipientIds are required");
  }

  const media = await getMediaForUser(mediaId, senderId);
  const recipients = await validateRecipients(senderId, recipientIds);

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

  const snap = await Snap.create({
    senderId,
    recipients: recipients.map((r) => ({ userId: r._id, deliveredAt: new Date() })),
    mediaType: media.mediaType,
    storageKey: media.storageKey,
    mediaUrl: media.mediaUrl,
    thumbnailUrl: media.thumbnailUrl,
    duration,
    expiresAt,
    isExpired: false,
  });

  await snap.populate("senderId", "name username profileImage isVerifiedBadge");
  await snap.populate("recipients.userId", "name username profileImage isVerifiedBadge");

  await deliverSnapToRecipients(snap._id.toString(), senderId);
  logger.info(`Snap sent via mediaId: ${snap._id} by user ${senderId} to ${recipients.length} recipients`);

  return formatSnapResponse(snap, senderId);
};

/**
 * Create snap metadata and generate pre-signed upload URL
 * @param {string} senderId - Sender user ID
 * @param {Object} snapData - Snap data
 * @param {Array<string>} snapData.recipientIds - Array of recipient user IDs
 * @param {string} snapData.mediaType - Media type ('image' or 'video')
 * @param {string} snapData.mimeType - MIME type
 * @param {number} snapData.duration - Duration in seconds (for videos)
 * @param {number} snapData.expiresInSeconds - Expiration time in seconds (default: 24 hours)
 * @returns {Promise<Object>} Snap metadata and upload URL
 */
export const createSnap = async (senderId, snapData) => {
  try {
    const {
      recipientIds,
      mediaType,
      mimeType,
      duration = null,
      expiresInSeconds = 86400, // Default: 24 hours
    } = snapData;

    // Validate media type
    if (!["image", "video"].includes(mediaType)) {
      throw new Error("Invalid media type. Must be 'image' or 'video'");
    }

    // Validate MIME type
    const validImageMimes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    const validVideoMimes = ["video/mp4", "video/quicktime", "video/x-msvideo"];
    const validMimes = [...validImageMimes, ...validVideoMimes];

    if (!validMimes.includes(mimeType)) {
      throw new Error("Invalid MIME type");
    }

    // Validate recipients
    const recipients = await validateRecipients(senderId, recipientIds);

    // Generate storage key for snap
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const extension = mimeType.includes("video") ? "mp4" : mimeType.split("/")[1] || "jpg";
    const fileType = mediaType === "video" ? "video" : "image";
    
    // Use snaps directory instead of default zeals directory
    const storageKey = `snaps/${senderId}/${fileType}/${timestamp}-${randomString}.${extension}`;

    // Calculate expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + expiresInSeconds);

    // Generate pre-signed upload URL (5 minutes expiry)
    const uploadExpiresIn = 300; // 5 minutes
    const { uploadUrl, headers } = await generatePresignedUploadUrl(
      storageKey,
      mimeType,
      uploadExpiresIn
    );

    // Create snap record
    const snap = await Snap.create({
      senderId,
      recipients: recipients.map((r) => ({
        userId: r._id,
        deliveredAt: new Date(),
      })),
      mediaType,
      storageKey,
      mediaUrl: getPublicUrl(storageKey), // Will be updated after upload
      duration,
      expiresAt,
      isExpired: false,
    });

    logger.info(`Snap created: ${snap._id} by user ${senderId} to ${recipients.length} recipients`);

    return {
      snapId: snap._id.toString(),
      uploadUrl,
      headers,
      expiresIn: uploadExpiresIn,
      storageKey,
      expiresAt: snap.expiresAt,
    };
  } catch (error) {
    logger.error("Error in createSnap:", error);
    throw error;
  }
};

/**
 * Confirm snap upload and finalize delivery
 * @param {string} snapId - Snap ID
 * @param {string} userId - User ID (must be sender)
 * @returns {Promise<Object>} Updated snap
 */
export const confirmSnapUpload = async (snapId, userId) => {
  try {
    const snap = await Snap.findById(snapId);

    if (!snap) {
      throw new Error("Snap not found");
    }

    // Verify user is the sender
    if (snap.senderId.toString() !== userId) {
      throw new Error("Unauthorized: Only sender can confirm upload");
    }

    // Verify file exists in storage
    const fileExists = await verifyFileExists(snap.storageKey);
    if (!fileExists) {
      throw new Error("Media file not found in storage. Please upload the file first.");
    }

    // Update media URL
    snap.mediaUrl = getPublicUrl(snap.storageKey);
    await snap.save();

    // Populate sender and recipients
    await snap.populate("senderId", "name username profileImage isVerifiedBadge");
    await snap.populate("recipients.userId", "name username profileImage isVerifiedBadge");

    logger.info(`Snap upload confirmed: ${snapId} by user ${userId}`);

    return formatSnapResponse(snap, userId);
  } catch (error) {
    logger.error("Error in confirmSnapUpload:", error);
    throw error;
  }
};

/**
 * Get secure view URL for a snap (time-limited pre-signed URL)
 * @param {string} snapId - Snap ID
 * @param {string} userId - User ID (must be recipient)
 * @returns {Promise<Object>} Snap data with secure view URL
 */
export const viewSnap = async (snapId, userId) => {
  try {
    const snap = await Snap.findById(snapId);

    if (!snap) {
      throw new Error("Snap not found");
    }

    // Check if snap is expired
    if (snap.checkExpiration()) {
      await snap.save();
      throw new Error("Snap has expired");
    }

    // Verify user is a recipient
    if (!snap.isRecipient(userId)) {
      throw new Error("Unauthorized: You are not a recipient of this snap");
    }

    // Mark as viewed if not already viewed
    const wasViewed = snap.markAsViewed(userId);
    await snap.save();

    // Generate secure pre-signed URL for viewing (expires in 1 minute)
    const client = initializeS3Client();
    let viewUrl = null;

    if (client) {
      const bucketName = getBucketName();
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: snap.storageKey,
      });

      viewUrl = await getSignedUrl(client, command, { expiresIn: 60 }); // 1 minute
    } else {
      // Fallback to public URL if S3 client not available
      viewUrl = snap.mediaUrl;
    }

    // Populate sender info
    await snap.populate("senderId", "name username profileImage isVerifiedBadge");

    const recipientInfo = snap.recipients.find(
      (r) => r.userId.toString() === userId.toString()
    );

    logger.info(`Snap viewed: ${snapId} by user ${userId} (wasViewed: ${wasViewed})`);

    return {
      snap: formatSnapResponse(snap, userId),
      viewUrl,
      viewUrlExpiresIn: 60, // 1 minute
      isViewed: recipientInfo.isViewed,
      viewedAt: recipientInfo.viewedAt,
    };
  } catch (error) {
    logger.error("Error in viewSnap:", error);
    throw error;
  }
};

/**
 * Get snaps inbox for a user (received snaps)
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Snaps with pagination
 */
export const getSnapsInbox = async (userId, options = {}) => {
  try {
    const { page = 1, limit = 20, includeExpired = false } = options;

    const snaps = await Snap.getUserSnaps(userId, {
      page,
      limit,
      includeExpired,
    });

    const total = await Snap.countDocuments({
      "recipients.userId": userId,
      ...(includeExpired ? {} : { isExpired: false, expiresAt: { $gt: new Date() } }),
    });

    const formattedSnaps = snaps.map((snap) => formatSnapResponse(snap, userId));

    return {
      snaps: formattedSnaps,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error in getSnapsInbox:", error);
    throw error;
  }
};

/**
 * Get sent snaps for a user
 * @param {string} senderId - Sender user ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Sent snaps with pagination
 */
export const getSentSnaps = async (senderId, options = {}) => {
  try {
    const { page = 1, limit = 20 } = options;

    const snaps = await Snap.getSentSnaps(senderId, { page, limit });

    const total = await Snap.countDocuments({ senderId });

    const formattedSnaps = snaps.map((snap) => formatSnapResponse(snap, senderId));

    return {
      snaps: formattedSnaps,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error in getSentSnaps:", error);
    throw error;
  }
};

/**
 * Format snap response
 * @param {Object} snap - Snap document
 * @param {string} userId - Current user ID
 * @returns {Object} Formatted snap
 */
const formatSnapResponse = (snap, userId) => {
  const recipientInfo = snap.recipients.find(
    (r) => r.userId.toString() === userId.toString()
  );

  return {
    id: snap._id.toString(),
    sender: {
      id: snap.senderId._id.toString(),
      name: snap.senderId.name,
      username: snap.senderId.username,
      profileImage: snap.senderId.profileImage,
      isVerifiedBadge: snap.senderId.isVerifiedBadge,
    },
    mediaType: snap.mediaType,
    thumbnailUrl: snap.thumbnailUrl,
    duration: snap.duration,
    expiresAt: snap.expiresAt,
    isExpired: snap.isExpired || snap.expiresAt < new Date(),
    viewCount: snap.viewCount,
    isViewed: recipientInfo ? recipientInfo.isViewed : null,
    viewedAt: recipientInfo ? recipientInfo.viewedAt : null,
    deliveredAt: recipientInfo ? recipientInfo.deliveredAt : null,
    recipientCount: snap.recipients.length,
    createdAt: snap.createdAt,
  };
};

/**
 * Deliver snap to recipients (create chat messages for each recipient)
 * @param {string} snapId - Snap ID
 * @param {string} senderId - Sender user ID
 * @returns {Promise<void>}
 */
export const deliverSnapToRecipients = async (snapId, senderId) => {
  try {
    const snap = await Snap.findById(snapId).populate("recipients.userId");

    if (!snap) {
      throw new Error("Snap not found");
    }

    if (snap.senderId.toString() !== senderId) {
      throw new Error("Unauthorized: Only sender can deliver snap");
    }

    // Import ChatRoom and ChatMessage here to avoid circular dependencies
    const ChatRoom = (await import("../models/chat/ChatRoom.js")).default;
    const ChatMessage = (await import("../models/chat/ChatMessage.js")).default;
    const ChatParticipant = (await import("../models/chat/ChatParticipant.js")).default;
    const { MessageType, MessageStatus } = await import("../models/enums.js");

    // Deliver to each recipient
    for (const recipient of snap.recipients) {
      try {
        // Find or create chat room
        let room = await ChatRoom.findOne({
          $or: [
            { userA: senderId, userB: recipient.userId._id },
            { userA: recipient.userId._id, userB: senderId },
          ],
        });

        if (!room) {
          room = await ChatRoom.create({
            userA: senderId,
            userB: recipient.userId._id,
            chatType: "Direct",
          });
        }

        if (room.isBlocked) {
          logger.warn(`Cannot deliver snap to blocked room: ${room._id}`);
          continue;
        }

        // Create chat message for the snap
        const message = await ChatMessage.create({
          roomId: room._id,
          senderId,
          messageType: MessageType.SNAP,
          mediaUrl: snap.mediaUrl,
          thumbnailUrl: snap.thumbnailUrl,
          status: MessageStatus.SENT,
        });

        // Update room's last message
        room.lastMessage = "📸 Snap";
        room.lastMessageType = MessageType.SNAP;
        room.lastMessageAt = message.createdAt;
        await room.save();

        // Update unread counts
        await ChatParticipant.findOneAndUpdate(
          { roomId: room._id, userId: recipient.userId._id },
          { $inc: { unreadCount: 1 } },
          { upsert: true, new: true }
        );

        await ChatParticipant.findOneAndUpdate(
          { roomId: room._id, userId: senderId },
          {
            unreadCount: 0,
            lastReadMessageId: message._id,
            lastReadAt: new Date(),
          },
          { upsert: true, new: true }
        );

        logger.info(`Snap delivered to recipient ${recipient.userId._id} in room ${room._id}`);
      } catch (error) {
        logger.error(`Error delivering snap to recipient ${recipient.userId._id}:`, error);
        // Continue with other recipients even if one fails
      }
    }
  } catch (error) {
    logger.error("Error in deliverSnapToRecipients:", error);
    throw error;
  }
};

export default {
  createSnap,
  confirmSnapUpload,
  sendSnapWithMediaId,
  viewSnap,
  getSnapsInbox,
  getSentSnaps,
  deliverSnapToRecipients,
};
