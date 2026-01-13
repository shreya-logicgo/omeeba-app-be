import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../utils/validation.js";
import { updateProfileSchema } from "../validators/user.validator.js";
import { updateProfile } from "../controllers/user.controller.js";

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

export default router;
