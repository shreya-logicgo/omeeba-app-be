import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import { JWT_SECRET } from "../config/env.js";
import User from "../models/users/User.js";

/**
 * Protect routes - Verify JWT token
 */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Not authorized to access this route",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        error: "User not found",
      });
    }

    next();
  } catch (error) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      error: "Not authorized to access this route",
    });
  }
};

/**
 * Authorize specific roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

