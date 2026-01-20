import express from "express";
import { validateParams, validateBody } from "../utils/validation.js";
import {
  toggleLikeBodySchema,
  contentTypeParamsSchema,
} from "../validators/content-like.validator.js";
import { toggle, getStatus } from "../controllers/content-like.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/content-likes/toggle
 * @desc    Toggle like status (like if not liked, unlike if liked)
 * @access  Private
 * @body    { contentType: string, contentId: string }
 */
router.post("/toggle", protect, validateBody(toggleLikeBodySchema), toggle);

/**
 * @route   GET /api/v1/content-likes/:contentType/:contentId/status
 * @desc    Get like status for content (isLiked and likeCount)
 * @access  Private
 */
router.get(
  "/:contentType/:contentId/status",
  protect,
  validateParams(contentTypeParamsSchema),
  getStatus
);

export default router;

