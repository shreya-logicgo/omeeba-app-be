import jwt from "jsonwebtoken";
import config from "../config/env.js";
import User from "../models/users/User.js";
import UserSession from "../models/users/UserSession.js";
import { sendUnauthorized, sendForbidden } from "../utils/response.js";
import logger from "../utils/logger.js";

const extractBearerToken = (req) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    return req.headers.authorization.split(" ")[1];
  }

  return null;
};

export const validateAccessTokenSession = async (token) => {
  const decoded = jwt.verify(token, config.jwt.secretKey);

  if (!decoded || !decoded.id || !decoded.sessionId || decoded.typ !== "access") {
    throw new Error("Invalid token");
  }

  const session = await UserSession.findOne({
    userId: decoded.id,
    sessionId: decoded.sessionId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    throw new Error("Session is no longer active");
  }

  const user = await User.findById(decoded.id).select("-password");

  if (!user) {
    throw new Error("User not found");
  }

  if (user.isDeleted) {
    throw new Error("User account has been deleted");
  }

  return { user, session, decoded };
};

/**
 * Protect routes - Verify JWT token and backing session.
 */
export const protect = async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    return sendUnauthorized(res, "Token is required");
  }

  try {
    const { user, session } = await validateAccessTokenSession(token);
    req.user = user;
    req.session = session;
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
 * Optional protect - Verify JWT token if present, but don't fail if missing
 * Useful for endpoints that work both with and without authentication
 */
export const optionalProtect = async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    req.user = null;
    req.session = null;
    return next();
  }

  try {
    const { user, session } = await validateAccessTokenSession(token);
    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    req.user = null;
    req.session = null;
    next();
  }
};

/**
 * Verify account status - Check if user account is verified and not deleted.
 * Must be used after protect middleware.
 */
export const verifyAccountStatus = (req, res, next) => {
  if (!req.user) {
    return sendUnauthorized(res, "User not authenticated");
  }

  if (req.user.isDeleted) {
    logger.warn(`Deleted user attempted to access: ${req.user.email}`);
    return sendUnauthorized(res, "User account has been deleted");
  }

  if (!req.user.isAccountVerified) {
    logger.warn(`Unverified user attempted to access: ${req.user.email}`);
    return sendUnauthorized(res, "Please verify your account to access this feature");
  }

  next();
};

/**
 * Authorize specific roles.
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendForbidden(
        res,
        `User role '${req.user?.role}' is not authorized to access this route`
      );
    }
    next();
  };
};
