import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody, validateParams } from "../utils/validation.js";
import { createWritePostSchema, deleteWritePostParamsSchema } from "../validators/writePost.validator.js";
import { createWritePost, deleteWritePost } from "../controllers/writePost.controller.js";

const router = express.Router();

/**
 * @route   POST /api/v1/write-posts
 * @desc    Create a new write post
 * @access  Private
 */
router.post("/", protect, validateBody(createWritePostSchema), createWritePost);

/**
 * @route   DELETE /api/v1/write-posts/:writePostId
 * @desc    Delete a write post (owner only)
 * @access  Private
 */
router.delete("/:writePostId", protect, validateParams(deleteWritePostParamsSchema), deleteWritePost);

export default router;

