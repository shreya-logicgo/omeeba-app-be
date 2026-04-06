/**
 * Zeal Routes
 * Routes for Zeal endpoints
 */

import express from "express";
import {
  startUpload,
  create,
  getStatus,
  uploadFile,
  deleteZeal,
  handleAudioAction,
  getMusicLibrary,
  getDraftAudio,
} from "../controllers/zeal.controller.js";
import { validateBody, validateParams } from "../utils/validation.js";
import {
  startZealUploadSchema,
  createZealSchema,
  getZealStatusParamsSchema,
  deleteZealParamsSchema,
  handleAudioActionSchema
} from "../validators/zeal.validator.js";
import { protect } from "../middleware/auth.js";
import { uploadSingle } from "../middleware/upload.js";

const router = express.Router();

/**
 * @route   POST /api/v1/zeals/upload
 * @desc    Upload file with automatic server-side chunking
 * @access  Private
 */
router.post("/upload", protect, uploadSingle, uploadFile);

/**
 * @route   POST /api/v1/zeals/start
 * @desc    Start Zeal upload - Generate pre-signed URL (for client-side upload)
 * @access  Private
 */
router.post(
  "/start",
  protect,
  validateBody(startZealUploadSchema),
  startUpload
);

/**
 * @route   POST /api/v1/zeals
 * @desc    Create Zeal post - Verify upload and start processing
 * @access  Private
 */
router.post("/", protect, validateBody(createZealSchema), create);


/**
 * @route   GET /api/v1/zeals/:zealId/status
 * @desc    Get Zeal post status
 * @access  Private
 */
router.get(
  "/:zealId/status",
  protect,
  validateParams(getZealStatusParamsSchema),
  getStatus
);

/**
 * @route   DELETE /api/v1/zeals/:zealId
 * @desc    Delete a Zeal post (owner only)
 * @access  Private
 */
router.delete(
  "/:zealId",
  protect,
  validateParams(deleteZealParamsSchema),
  deleteZeal
);

/**
 * @route   POST /api/v1/zeals/:zealId/handle-audio
 * @desc    Handle audio decision (original, mute, replace)
 * @access  Private
 */
router.post(
  "/:zealId/handle-audio",
  protect,
  validateBody(handleAudioActionSchema),
  handleAudioAction
);

/**
 * @route   GET /api/v1/zeals/music
 * @desc    Get music library for audio replacement
 * @access  Private
 */
router.get("/music", protect, getMusicLibrary);

/**
 * @route   GET /api/v1/zeals/drafts/:draftId/audio
 * @desc    Get extracted audio from a draft
 * @access  Private
 */
router.get("/drafts/:draftId/audio", protect, getDraftAudio);

export default router;

