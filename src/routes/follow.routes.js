/**
 * Follow Routes
 * Routes for Follow/Unfollow endpoints
 */

import express from "express";
import {
  follow,
  unfollow,
  getFollowStatus,
  getFollowersList,
  getFollowingList,
  getFollowCountsList,
} from "../controllers/follow.controller.js";
import { validateParams, validateQuery } from "../utils/validation.js";
import {
  followUserParamsSchema,
  getFollowStatusParamsSchema,
  getFollowersParamsSchema,
  getFollowersQuerySchema,
  getFollowCountsQuerySchema,
} from "../validators/follow.validator.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/follow/:userId
 * @desc    Follow a user
 * @access  Private
 */
router.post(
  "/:userId",
  protect,
  validateParams(followUserParamsSchema),
  follow
);

/**
 * @route   DELETE /api/v1/follow/:userId
 * @desc    Unfollow a user
 * @access  Private
 */
router.delete(
  "/:userId",
  protect,
  validateParams(followUserParamsSchema),
  unfollow
);

/**
 * @route   GET /api/v1/follow/:userId/status
 * @desc    Check if following a user
 * @access  Private
 */
router.get(
  "/:userId/status",
  protect,
  validateParams(getFollowStatusParamsSchema),
  getFollowStatus
);

/**
 * @route   GET /api/v1/follow/followers
 * @desc    Get followers list (if userId query param is "me" or not provided, returns current user's followers)
 * @access  Private
 */
router.get(
  "/followers",
  protect,
  validateQuery(getFollowersQuerySchema),
  getFollowersList
);

/**
 * @route   GET /api/v1/follow/following
 * @desc    Get following list (if userId query param is "me" or not provided, returns current user's following)
 * @access  Private
 */
router.get(
  "/following",
  protect,
  validateQuery(getFollowersQuerySchema),
  getFollowingList
);

/**
 * @route   GET /api/v1/follow/count
 * @desc    Get follower and following counts (if userId query param is "me" or not provided, returns current user's counts)
 * @access  Private
 */
router.get(
  "/count",
  protect,
  validateQuery(getFollowCountsQuerySchema),
  getFollowCountsList
);

export default router;

