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
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/auth.controller.js";
import { validateBody } from "../utils/validation.js";
import {
  registerSchema,
  verifyOTPSchema,
  resendOTPSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../validators/auth.validator.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post("/register", validateBody(registerSchema), register);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP for account verification or forgot password
 * @access  Public
 * @body    { email, otp, type? } - type is optional: "account" or "password" (auto-detected if not provided)
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

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send OTP for password reset
 * @access  Public
 */
router.post(
  "/forgot-password",
  validateBody(forgotPasswordSchema),
  forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password after OTP verification
 * @access  Public
 * @note    OTP must be verified first using /verify-otp with type="password"
 */
router.post(
  "/reset-password",
  validateBody(resetPasswordSchema),
  resetPassword
);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 * @body    { oldPassword, newPassword }
 */
router.put(
  "/change-password",
  protect,
  validateBody(changePasswordSchema),
  changePassword
);

export default router;
