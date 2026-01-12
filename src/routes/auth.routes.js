/**
 * Auth Routes
 * Routes for authentication endpoints
 */

import express from "express";
import { register } from "../controllers/auth.controller.js";
import { validateBody } from "../utils/validation.js";
import { registerSchema } from "../validators/auth.validator.js";

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", validateBody(registerSchema), register);

export default router;

