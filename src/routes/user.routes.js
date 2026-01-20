import express from "express";
import { validateBody, validateParams } from "../utils/validation.js";
import {
  updateProfileSchema,
  getUserProfileParamsSchema,
  getUserPostQueries,
  getMentionedPostsQuerySchema,
} from "../validators/user.validator.js";
import {
  updateProfile,
  getUserProfile,
  getUserPost,
  getUserWritePosts,
  getUserPolls,
  getMentionedPosts,
} from "../controllers/user.controller.js";
import { protect } from "../middleware/auth.js";
import { searchUsers } from "../controllers/user.controller.js";
import { validateQuery } from "../utils/validation.js";
import { searchUsersQuerySchema } from "../validators/user.validator.js";

const router = express.Router();

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  protect,
  validateBody(updateProfileSchema),
  updateProfile
);

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get own user profile
 * @access  Private
 */
router.get("/profile", protect, getUserProfile);

/**
 * @route   GET /api/v1/users/:userId/profile
 * @desc    Get user profile by ID
 * @access  Private (to get follow status)
 */
router.get(
  "/:userId/profile",
  protect,
  validateParams(getUserProfileParamsSchema),
  getUserProfile
);

/*
 * @route   GET / api / v1 / users / search
 * @desc    Search users by username
 * @access  Private
 */
router.get(
  "/search",
  protect,
  validateQuery(searchUsersQuerySchema),
  searchUsers
);

/*
 * @route   GET / api / v1 / users / post
 * @desc    Search users by userId
 * @access  Private
 */
router.get("/posts", protect, validateQuery(getUserPostQueries), getUserPost);

/*
 * @route   GET / api / v1 / users / write-posts
 * @desc    Search users by userId
 * @access  Private
 */
router.get(
  "/write-posts",
  protect,
  validateQuery(getUserPostQueries),
  getUserWritePosts
);

/*
 * @route   GET / api / v1 / users / polls
 * @desc    Search users by userId
 * @access  Private
 */
router.get("/polls", protect, validateQuery(getUserPostQueries), getUserPolls);

/*
 * @route   GET /api/v1/users/mentioned-posts
 * @desc    Get posts where user is mentioned (from Post and WritePost)
 * @access  Private
 */
router.get(
  "/mentioned-posts",
  protect,
  validateQuery(getMentionedPostsQuerySchema),
  getMentionedPosts
);

export default router;
