import express from "express";
import { protect } from "../middleware/auth.js";
import { validateQuery } from "../utils/validation.js";
import { getHomeFeed } from "../controllers/home.controller.js";
import { getHomeFeedSchema } from "../validators/home.validator.js";

const router = express.Router();

/**
 * @route   GET /api/v1/home
 * @desc    Get home feed (followed -> trending -> latest)
 * @access  Private
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get("/", protect, validateQuery(getHomeFeedSchema), getHomeFeed);

export default router;
