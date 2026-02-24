import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody, validateParams } from "../utils/validation.js";
import { createPostSchema, deletePostParamsSchema } from "../validators/post.validator.js";
import { createPost, deletePost } from "../controllers/post.controller.js";
import { uploadPostImages } from "../middleware/upload.js";

const router = express.Router();

/**
 * @route   POST /api/v1/posts
 * @desc    Create a new post
 * @access  Private
 */
router.post("/", protect, uploadPostImages, validateBody(createPostSchema), createPost);

/**
 * @route   DELETE /api/v1/posts/:postId
 * @desc    Delete a post (owner only)
 * @access  Private
 */
router.delete("/:postId", protect, validateParams(deletePostParamsSchema), deletePost);

export default router;
