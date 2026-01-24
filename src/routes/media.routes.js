/**
 * Media Routes
 * REST API for uploading chat/snap media. Returns mediaId for Socket.IO.
 */

import express from "express";
import { uploadMediaHandler } from "../controllers/media.controller.js";
import { protect } from "../middleware/auth.js";
import { uploadSingle } from "../middleware/upload.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();
const mediaRateLimiter = createRateLimiter({
  maxRequests: 30,
  windowMs: 60_000,
  message: "Too many uploads. Please try again later.",
});

/**
 * @route   POST /api/v1/media/upload
 * @desc    Upload image/video. Returns { mediaId, mediaUrl, thumbnailUrl, mediaType }.
 *          Use mediaId in Socket.IO (send_message, send_snap).
 * @access  Private
 */
router.post("/upload", protect, mediaRateLimiter, uploadSingle, uploadMediaHandler);

export default router;
