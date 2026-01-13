import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody, validateParams } from "../utils/validation.js";
import {
  updateProfileSchema,
  getUserProfileParamsSchema,
} from "../validators/user.validator.js";
import {
  updateProfile,
  getUserProfile,
} from "../controllers/user.controller.js";

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

export default router;
