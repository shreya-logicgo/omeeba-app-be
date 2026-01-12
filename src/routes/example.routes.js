/**
 * Example Routes File
 * This shows how to use validators and response functions in routes
 */

import express from "express";
import { protect } from "../middleware/auth.js";
import {
  validateUserCreate,
  validateUserUpdate,
  validateGetUsers,
  validateUserId,
} from "../validators/example.validator.js";
import {
  sendSuccess,
  sendError,
  sendPaginated,
  sendNotFound,
} from "../utils/response.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";

const router = express.Router();

/**
 * Example: Create user route
 * POST /api/v1/users
 */
router.post("/", validateUserCreate, async (req, res) => {
  try {
    // Your business logic here
    const user = { id: "123", ...req.body }; // Example

    sendSuccess(res, user, "User created successfully", 201);
  } catch (error) {
    sendError(res, "Failed to create user", "Server Error", error.message, 500);
  }
});

/**
 * Example: Get users with pagination
 * GET /api/v1/users
 */
router.get("/", validateGetUsers, async (req, res) => {
  try {
    const { page, limit } = getPagination(req);

    // Your business logic here
    const users = []; // Example data
    const total = 0; // Example total

    const pagination = getPaginationMeta(total, page, limit);

    sendPaginated(res, users, pagination, "Users retrieved successfully");
  } catch (error) {
    sendError(res, "Failed to fetch users", "Server Error", error.message, 500);
  }
});

/**
 * Example: Get user by ID
 * GET /api/v1/users/:id
 */
router.get("/:id", validateUserId, async (req, res) => {
  try {
    // const { id } = req.params; // Use when needed

    // Your business logic here
    const user = null; // Example

    if (!user) {
      return sendNotFound(res, "User not found");
    }

    sendSuccess(res, user, "User retrieved successfully");
  } catch (error) {
    sendError(res, "Failed to fetch user", "Server Error", error.message, 500);
  }
});

/**
 * Example: Update user
 * PUT /api/v1/users/:id
 */
router.put(
  "/:id",
  protect,
  validateUserId,
  validateUserUpdate,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Your business logic here
      const user = { id, ...req.body }; // Example

      sendSuccess(res, user, "User updated successfully");
    } catch (error) {
      sendError(
        res,
        "Failed to update user",
        "Server Error",
        error.message,
        500
      );
    }
  }
);

export default router;
