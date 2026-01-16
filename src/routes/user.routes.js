/**
 * User Routes
 * Routes for User search endpoints
 */

import express from "express";
import { searchUsers } from "../controllers/user.controller.js";
import { validateQuery } from "../utils/validation.js";
import { searchUsersQuerySchema } from "../validators/user.validator.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   GET /api/v1/users/search
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

