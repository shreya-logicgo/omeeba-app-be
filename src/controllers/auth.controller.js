/**
 * Auth Controller
 * Handles authentication-related HTTP requests
 */

import { registerUser } from "../services/auth.service.js";
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

export default {
  register,
};
