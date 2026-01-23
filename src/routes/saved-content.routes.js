/**
 * Saved Content Routes
 * Routes for saving and unsaving content (posts, zeal posts, write posts)
 */

import express from "express";
import { validateBody } from "../utils/validation.js";
import {
  saveContentBodySchema,
  validateSavedContentListBody,
} from "../validators/saved-content.validator.js";
import {
  toggle,
  save,
  unsave,
  getStatus,
  getList,
} from "../controllers/saved-content.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/saved-content/toggle
 * @desc    Toggle save status (save if not saved, unsave if saved)
 * @access  Private
 */
router.post("/toggle", protect, validateBody(saveContentBodySchema), toggle);

/**
 * @route   POST /api/v1/saved-content/save
 * @desc    Save content
 * @access  Private
 */
router.post("/save", protect, validateBody(saveContentBodySchema), save);

/**
 * @route   POST /api/v1/saved-content/unsave
 * @desc    Unsave content
 * @access  Private
 */
router.post("/unsave", protect, validateBody(saveContentBodySchema), unsave);

/**
 * @route   POST /api/v1/saved-content/status
 * @desc    Get saved status for content (isSaved)
 * @access  Private
 */
router.post("/status", protect, validateBody(saveContentBodySchema), getStatus);

/**
 * @route   POST /api/v1/saved-content/list
 * @desc    Get user's saved content list with pagination and filtering
 * @access  Private
 */
router.post("/list", protect, validateSavedContentListBody, getList);

export default router;

