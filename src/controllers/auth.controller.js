/**
 * Auth Controller
 * Handles authentication-related HTTP requests
 */

import {
  registerUser,
  verifyOTP as verifyOTPService,
  resendOTP as resendOTPService,
  loginUser,
} from "../services/auth.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Register new user
 * @route POST /api/v1/auth/register
 * @access Public
 */
export const register = async (req, res) => {
  try {
    const userData = req.body;

    // Register user
    const user = await registerUser(userData);

    // Determine message based on whether OTP was resent
    const message = user.isResendOTP
      ? "OTP has been resent to your email. Please check your email for OTP verification."
      : "User registered successfully. Please check your email for OTP verification.";

    // Return success response
    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          countryCode: user.countryCode,
          name: user.name,
          username: user.username,
          isAccountVerified: user.isAccountVerified,
          createdAt: user.createdAt,
        },
      },
      message,
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Registration error:", error);

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message = `User with this ${field} already exists`;
      return sendBadRequest(res, message);
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      const message = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return sendBadRequest(res, message);
    }

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to register user",
      "Registration Error",
      error.message || "An error occurred during registration",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Verify OTP
 * @route POST /api/v1/auth/verify-otp
 * @access Public
 */
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Verify OTP
    const user = await verifyOTPService(email, otp);

    // Return success response
    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          countryCode: user.countryCode,
          name: user.name,
          username: user.username,
          isAccountVerified: user.isAccountVerified,
          createdAt: user.createdAt,
        },
      },
      "Account verified successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("OTP verification error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to verify OTP",
      "Verification Error",
      error.message || "An error occurred during OTP verification",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Resend OTP
 * @route POST /api/v1/auth/resend-otp
 * @access Public
 */
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Resend OTP
    const user = await resendOTPService(email);

    // Return success response
    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          isAccountVerified: user.isAccountVerified,
        },
      },
      "OTP has been resent to your email. Please check your email for OTP verification.",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Resend OTP error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to resend OTP",
      "Resend OTP Error",
      error.message || "An error occurred while resending OTP",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Login user
 * @route POST /api/v1/auth/login
 * @access Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Login user
    const { user, token } = await loginUser(email, password);

    // Return success response with token
    return sendSuccess(
      res,
      {
        token,
        user: {
          id: user._id,
          email: user.email,
          phoneNumber: user.phoneNumber,
          countryCode: user.countryCode,
          name: user.name,
          username: user.username,
          profileImage: user.profileImage,
          bio: user.bio,
          isVerifiedBadge: user.isVerifiedBadge,
          isAccountVerified: user.isAccountVerified,
          role: user.role,
          createdAt: user.createdAt,
        },
      },
      "Login successful",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Login error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to login",
      "Login Error",
      error.message || "An error occurred during login",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  register,
  verifyOTP,
  resendOTP,
  login,
};
