/**
 * Auth Routes
 * Routes for authentication endpoints
 */

import express from "express";
import {
  register,
  verifyOTP,
  resendOTP,
  login,
} from "../controllers/auth.controller.js";
import { validateBody } from "../utils/validation.js";
import {
  registerSchema,
  verifyOTPSchema,
  resendOTPSchema,
  loginSchema,
} from "../validators/auth.validator.js";

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", validateBody(registerSchema), register);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP for account verification
 * @access  Public
 */
router.post("/verify-otp", validateBody(verifyOTPSchema), verifyOTP);

/**
 * @route   POST /api/v1/auth/resend-otp
 * @desc    Resend OTP to user's email
 * @access  Public
 */
router.post("/resend-otp", validateBody(resendOTPSchema), resendOTP);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user and get JWT token
 * @access  Public
 */
router.post("/login", validateBody(loginSchema), login);

export default router;
