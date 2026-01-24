/**
 * Snap Routes
 * Routes for snap endpoints
 */

import express from "express";
import {
  createSnapHandler,
  confirmSnapUploadHandler,
  viewSnapHandler,
  getSnapsInboxHandler,
  getSentSnapsHandler,
} from "../controllers/snap.controller.js";
import { validateQuery, validateBody, validateParams } from "../utils/validation.js";
import {
  createSnapBodySchema,
  snapIdParamsSchema,
  getSnapsQuerySchema,
} from "../validators/snap.validator.js";
import { protect } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Rate limiter for snap creation (10 snaps per minute)
const snapRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  message: "Too many snaps. Please wait a moment before sending another snap.",
});

/**
 * @route   POST /api/v1/snaps
 * @desc    Create a new snap and get pre-signed upload URL
 * @access  Private
 */
router.post(
  "/",
  protect,
  snapRateLimiter,
  validateBody(createSnapBodySchema),
  createSnapHandler
);

/**
 * @route   POST /api/v1/snaps/:snapId/confirm
 * @desc    Confirm snap upload and deliver to recipients
 * @access  Private
 */
router.post(
  "/:snapId/confirm",
  protect,
  validateParams(snapIdParamsSchema),
  confirmSnapUploadHandler
);

/**
 * @route   GET /api/v1/snaps/:snapId/view
 * @desc    View a snap (get secure view URL)
 * @access  Private
 */
router.get(
  "/:snapId/view",
  protect,
  validateParams(snapIdParamsSchema),
  viewSnapHandler
);

/**
 * @route   GET /api/v1/snaps/inbox
 * @desc    Get snaps inbox (received snaps)
 * @access  Private
 */
router.get(
  "/inbox",
  protect,
  validateQuery(getSnapsQuerySchema),
  getSnapsInboxHandler
);

/**
 * @route   GET /api/v1/snaps/sent
 * @desc    Get sent snaps
 * @access  Private
 */
router.get(
  "/sent",
  protect,
  validateQuery(getSnapsQuerySchema),
  getSentSnapsHandler
);

export default router;
