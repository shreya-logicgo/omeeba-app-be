import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../utils/validation.js";
import { createPostSchema } from "../validators/post.validator.js";
import { createPost } from "../controllers/post.controller.js";
import { uploadPostImages } from "../middleware/upload.js";

const router = express.Router();

/**
 * @route   POST /api/v1/posts
 * @desc    Create a new post
 * @access  Private
 */
router.post("/", protect, uploadPostImages, validateBody(createPostSchema), createPost);

export default router;
