// controllers/content.controller.js
import { getSingleContent, updateContent, deleteContent } from "../services/content.service.js";
import { sendSuccess, sendBadRequest } from "../utils/response.js";
import logger from "../utils/logger.js";
import {
  generateStorageKey,
  uploadBufferToStorage,
} from "../services/storage.service.js";

/**
 * Helper to normalize arrays from body (comma-separated or JSON)
 */
const normalizeStringArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {}

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

// -------------------------
// GET Single Content
// -------------------------
export const getContentController = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const content = await getSingleContent(contentType, contentId);
    return sendSuccess(res, { content }, `${contentType} fetched successfully`);
  } catch (error) {
    logger.error("Get content error:", error);
    return sendBadRequest(res, error.message);
  }
};

// -------------------------
// UPDATE Content
// -------------------------
export const updateContentController = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const userId = req.user._id;

    let updateData = { ...req.body };

    // Normalize arrays from multipart or body
    if (updateData.images !== undefined) updateData.images = normalizeStringArray(updateData.images);
    if (updateData.videos !== undefined) updateData.videos = normalizeStringArray(updateData.videos);
    if (updateData.mentionedUserIds !== undefined) updateData.mentionedUserIds = normalizeStringArray(updateData.mentionedUserIds);

    // Upload files if provided
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map(async (file) => {
        const isVideo = file.mimetype.startsWith("video");
        const fileType = isVideo ? "video" : "image";

        const folder = contentType === "ZEAL" ? "zeal" : "posts";

        const storageKey = generateStorageKey(
          userId.toString(),
          fileType,
          file.mimetype,
          folder
        );

        return uploadBufferToStorage(
          storageKey,
          file.buffer,
          file.mimetype
        );
      });

      const uploadedUrls = await Promise.all(uploadPromises);

      // Merge uploaded URLs into correct arrays
      uploadedUrls.forEach((url, index) => {
        const file = req.files[index];
        if (file.mimetype.startsWith("video")) {
          if (!updateData.videos) updateData.videos = [];
          updateData.videos.push(url);
        } else {
          if (!updateData.images) updateData.images = [];
          updateData.images.push(url);
        }
      });
    }

    const content = await updateContent(
      contentType,
      contentId,
      userId,
      updateData
    );

    return sendSuccess(
      res,
      { content },
      `${contentType} updated successfully`
    );
  } catch (error) {
    logger.error("Update content error:", error);
    return sendBadRequest(res, error.message);
  }
};

// -------------------------
// DELETE Content
// -------------------------
export const deleteContentController = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    await deleteContent(contentType, contentId, req.user._id);
    return sendSuccess(res, {}, `${contentType} deleted successfully`);
  } catch (error) {
    logger.error("Delete content error:", error);
    return sendBadRequest(res, error.message);
  }
};