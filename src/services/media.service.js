/**
 * Media Service
 * Upload media (image/video) to server storage; used by Chat & Snap via Socket with mediaId.
 */

import fs from "fs";
import crypto from "crypto";
import Media from "../models/chat/Media.js";
import { uploadBuffer, getPublicUrl } from "./storage.service.js";
import logger from "../utils/logger.js";

const ALLOWED_IMAGE = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime", "video/x-msvideo"];
const ALLOWED = [...ALLOWED_IMAGE, ...ALLOWED_VIDEO];
const MAX_IMAGE_MB = 15;
const MAX_VIDEO_MB = 50;

function validateMime(mimetype) {
  if (!ALLOWED.includes(mimetype)) {
    throw new Error(`Invalid file type. Allowed: ${ALLOWED.join(", ")}`);
  }
}

function validateSize(size, mimetype) {
  const isVideo = ALLOWED_VIDEO.includes(mimetype);
  const maxBytes = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024;
  if (size > maxBytes) {
    throw new Error(`File too large. Max ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB}MB for ${isVideo ? "video" : "image"}.`);
  }
}

/**
 * Upload media file (multer temp file) to S3, create Media doc, return { mediaId, mediaUrl, thumbnailUrl, mediaType }.
 * @param {string} userId
 * @param {{ path: string; mimetype: string; size: number }} file - multer file
 * @returns {Promise<{ mediaId: string; mediaUrl: string; thumbnailUrl: string | null; mediaType: string }>}
 */
export async function uploadMedia(userId, file) {
  const { path: tempPath, mimetype, size } = file;
  validateMime(mimetype);
  validateSize(size, mimetype);

  const mediaType = ALLOWED_VIDEO.includes(mimetype) ? "video" : "image";
  const ext = mimetype.includes("video") ? "mp4" : (mimetype.split("/")[1] || "jpg");
  const ts = Date.now();
  const rand = crypto.randomBytes(8).toString("hex");
  const storageKey = `media/${userId}/${mediaType}/${ts}-${rand}.${ext}`;

  let buffer;
  try {
    buffer = await fs.promises.readFile(tempPath);
  } finally {
    try {
      await fs.promises.unlink(tempPath);
    } catch (e) {
      logger.warn("Media upload: failed to delete temp file", tempPath, e);
    }
  }

  await uploadBuffer(storageKey, buffer, mimetype);
  const mediaUrl = getPublicUrl(storageKey);

  const doc = await Media.create({
    userId,
    mediaType,
    mimeType: mimetype,
    storageKey,
    mediaUrl,
    thumbnailUrl: null,
    duration: null,
  });

  logger.info(`Media uploaded: ${doc._id} by user ${userId} (${mediaType})`);

  return {
    mediaId: doc._id.toString(),
    mediaUrl: doc.mediaUrl,
    thumbnailUrl: doc.thumbnailUrl,
    mediaType: doc.mediaType,
  };
}

/**
 * Get media by id; ensure it exists and belongs to user.
 * @param {string} mediaId
 * @param {string} userId
 * @returns {Promise<{ mediaUrl: string; thumbnailUrl: string | null; mediaType: string; storageKey: string }>}
 */
export async function getMediaForUser(mediaId, userId) {
  const doc = await Media.findById(mediaId).lean();
  if (!doc) throw new Error("Media not found");
  if (doc.userId.toString() !== userId) throw new Error("Unauthorized: media belongs to another user");
  return {
    mediaUrl: doc.mediaUrl,
    thumbnailUrl: doc.thumbnailUrl,
    mediaType: doc.mediaType,
    storageKey: doc.storageKey,
  };
}

export default { uploadMedia, getMediaForUser };
