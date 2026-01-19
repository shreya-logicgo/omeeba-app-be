import express from "express";
import { validateBody, validateParams } from "../utils/validation.js";
import {
  updateProfileSchema,
  getUserProfileParamsSchema,
} from "../validators/user.validator.js";
import {
  updateProfile,
  getUserProfile,
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

export default router;
