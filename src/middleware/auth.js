import jwt from "jsonwebtoken";
import config from "../config/env.js";
import User from "../models/users/User.js";
import { sendUnauthorized, sendForbidden } from "../utils/response.js";
import logger from "../utils/logger.js";

/**
 * Protect routes - Verify JWT token
 * Handles token expiration, invalid tokens, and other JWT errors
 */
export const protect = async (req, res, next) => {
  let token;

  // Extract token from Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Check if token exists
  if (!token) {
    return sendUnauthorized(res, "Token is required");
  }

  try {
    // Verify and decode token
    const decoded = jwt.verify(token, config.jwt.secretKey);

    // Check if decoded token has required fields
    if (!decoded || !decoded.id) {
      logger.warn("Invalid token payload structure");
      return sendUnauthorized(res, "Invalid token");
    }

    // Find user by ID from token
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      logger.warn(`User not found for token ID: ${decoded.id}`);
      return sendUnauthorized(res, "User not found");
    }

    // Check if user account is deleted
    if (user.isDeleted) {
      logger.warn(`Deleted user attempted to access: ${user.email}`);
      return sendUnauthorized(res, "User account has been deleted");
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    // Handle different JWT error types
    if (error.name === "TokenExpiredError") {
      logger.warn("Token expired:", {
        expiredAt: error.expiredAt,
        path: req.path,
      });
      return sendUnauthorized(res, "Token has expired. Please login again");
    }

    if (error.name === "JsonWebTokenError") {
      logger.warn("Invalid token:", {
        message: error.message,
        path: req.path,
      });
      return sendUnauthorized(res, "Invalid token. Please login again");
    }

    if (error.name === "NotBeforeError") {
      logger.warn("Token not active yet:", {
        date: error.date,
        path: req.path,
      });
      return sendUnauthorized(res, "Token is not active yet");
    }

    // Handle other errors
    logger.error("Token verification error:", {
      error: error.message,
      name: error.name,
      path: req.path,
    });
    return sendUnauthorized(res, "Not authorized to access this route");
  }
};

/**
 * Authorize specific roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `User role '${req.user.role}' is not authorized to access this route`
      );
    }
    next();
  };
};
