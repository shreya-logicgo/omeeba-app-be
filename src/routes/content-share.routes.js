import express from "express";
import { validateBody } from "../utils/validation.js";
import {
  shareContentBodySchema,
  getShareCountBodySchema,
} from "../validators/content-share.validator.js";
import {
  share,
  getSentShares,
  getReceivedShares,
  getShareCount,
} from "../controllers/content-share.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/content-shares/share
 * @desc    Share content with one or more users
 * @access  Private
 * @body    { contentType: string, contentId: string, receiverIds: Array<string> }
 */
router.post("/share", protect, validateBody(shareContentBodySchema), share);

/**
 * @route   GET /api/v1/content-shares/sent
 * @desc    Get shares sent by the logged-in user
 * @access  Private
 */
router.get("/sent", protect, getSentShares);

/**
 * @route   GET /api/v1/content-shares/received
 * @desc    Get shares received by the logged-in user
 * @access  Private
 */
router.get("/received", protect, getReceivedShares);

/**
 * @route   POST /api/v1/content-shares/count
 * @desc    Get share count for specific content
 * @access  Private
 * @body    { contentType: string, contentId: string }
 */
router.post("/count", protect, validateBody(getShareCountBodySchema), getShareCount);

export default router;

