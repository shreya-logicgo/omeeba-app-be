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
  getUserZeals,
  getUserPolls,
  getMentionedPosts,
} from "../controllers/user.controller.js";
import { protect, verifyAccountStatus } from "../middleware/auth.js";
import {
  searchUsers,
  searchUsersForMentionsHandler,
} from "../controllers/user.controller.js";
import { uploadProfileImages } from "../middleware/upload.js";
import { validateQuery } from "../utils/validation.js";
import {
  searchUsersQuerySchema,
  searchMentionsQuerySchema,
} from "../validators/user.validator.js";

const router = express.Router();

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  "/profile",
  protect,
  verifyAccountStatus,
  uploadProfileImages,
  validateBody(updateProfileSchema),
  updateProfile
);

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get own user profile
 * @access  Private
 */
router.get("/profile", protect, verifyAccountStatus, getUserProfile);

/**
 * @route   GET /api/v1/users/:userId/profile
 * @desc    Get user profile by ID
 * @access  Private (to get follow status)
 */
router.get(
  "/:userId/profile",
  protect,
  verifyAccountStatus,
  validateParams(getUserProfileParamsSchema),
  getUserProfile
);

/*
 * @route   GET /api/v1/users/search
 * @desc    Search users by username
 * @access  Private
 */
router.get(
  "/search",
  protect,
  verifyAccountStatus,
  validateQuery(searchUsersQuerySchema),
  searchUsers
);

/**
 * @route   GET /api/v1/users/mentions/search
 * @desc    Search users for mention autocomplete (@username suggestions)
 * @access  Private
 */
router.get(
  "/mentions/search",
  protect,
  verifyAccountStatus,
  validateQuery(searchMentionsQuerySchema),
  searchUsersForMentionsHandler
);

/*
 * @route   GET / api / v1 / users / post
 * @desc    Search users by userId
 * @access  Private
 */
router.get("/posts", protect, verifyAccountStatus, validateQuery(getUserPostQueries), getUserPost);

/*
 * @route   GET / api / v1 / users / write-posts
 * @desc    Search users by userId
 * @access  Private
 */
router.get(
  "/write-posts",
  protect,
  verifyAccountStatus,
  validateQuery(getUserPostQueries),
  getUserWritePosts
);

/*
 * @route   GET /api/v1/users/zeals
 * @desc    Get user's zeal posts
 * @access  Private
 */
router.get("/zeals", protect, verifyAccountStatus, validateQuery(getUserPostQueries), getUserZeals);

/*
 * @route   GET / api / v1 / users / polls
 * @desc    Search users by userId
 * @access  Private
 */
router.get("/polls", protect, verifyAccountStatus, validateQuery(getUserPostQueries), getUserPolls);

/*
 * @route   GET /api/v1/users/mentioned-posts
 * @desc    Get posts where user is mentioned (from Post and WritePost)
 * @access  Private
 */
router.get(
  "/mentioned-posts",
  protect,
  verifyAccountStatus,
  validateQuery(getMentionedPostsQuerySchema),
  getMentionedPosts
);

export default router;
