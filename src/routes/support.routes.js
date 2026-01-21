/**
 * Support Routes
 * Routes for support request endpoints
 */

import express from "express";
import {
  createSupportRequestHandler,
  getSupportRequestsHandler,
} from "../controllers/supportRequest.controller.js";
import { validateBody, validateQuery } from "../utils/validation.js";
import {
  createSupportRequestBodySchema,
  getSupportRequestsQuerySchema,
} from "../validators/chat.validator.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/support/requests
 * @desc    Create a support request (auto-creates chat room)
 * @access  Private
 */
router.post(
  "/requests",
  protect,
  validateBody(createSupportRequestBodySchema),
  createSupportRequestHandler
);

/**
 * @route   GET /api/v1/support/requests
 * @desc    Get support requests for logged-in user
 * @access  Private
 */
router.get(
  "/requests",
  protect,
  validateQuery(getSupportRequestsQuerySchema),
  getSupportRequestsHandler
);

export default router;
