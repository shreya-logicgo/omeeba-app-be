/**
 * Media Upload Controller
 * Single REST API for uploading chat/snap media. Returns mediaId for use in Socket.IO.
 */

import { uploadMedia } from "../services/media.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * POST /api/v1/media/upload
 * Upload image or video. Returns { mediaId, mediaUrl, thumbnailUrl, mediaType }.
 * Client uses mediaId in Socket events (send_message, send_snap).
 */
export async function uploadMediaHandler(req, res) {
  try {
    if (!req.file) {
      return sendBadRequest(res, "No file uploaded. Use form field 'file'.");
    }
    const userId = req.user._id.toString();
    const result = await uploadMedia(userId, req.file);
    return sendSuccess(res, result, "Media uploaded successfully", StatusCodes.CREATED);
  } catch (e) {
    logger.error("Media upload error:", e);
    if (e.message && (e.message.includes("Invalid file type") || e.message.includes("too large") || e.message.includes("not initialized") || e.message.includes("bucket"))) {
      return sendBadRequest(res, e.message);
    }
    return sendError(res, "Media upload failed", "Media Upload Error", e.message || "Upload failed", StatusCodes.INTERNAL_SERVER_ERROR);
  }
}
