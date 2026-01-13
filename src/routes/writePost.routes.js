import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../utils/validation.js";
import { createWritePostSchema } from "../validators/writePost.validator.js";
import { createWritePost } from "../controllers/writePost.controller.js";

const router = express.Router();

/**
 * @route   POST /api/v1/write-posts
 * @desc    Create a new write post
 * @access  Private
 */
router.post("/", protect, validateBody(createWritePostSchema), createWritePost);

export default router;

