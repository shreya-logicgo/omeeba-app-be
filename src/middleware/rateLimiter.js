/**
 * Rate Limiting Middleware
 * Prevents spam by limiting requests per user
 */

import { sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

// In-memory store for rate limiting
// Format: { userId: { count: number, resetTime: Date } }
const rateLimitStore = new Map();

// Cleanup interval to remove expired entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [userId, data] of rateLimitStore.entries()) {
    if (data.resetTime < now) {
      rateLimitStore.delete(userId);
    }
  }
}, 5 * 60 * 1000);

/**
 * Create rate limiter middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.maxRequests - Maximum requests allowed
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} options.message - Error message when limit exceeded
 * @returns {Function} Express middleware
 */
export const createRateLimiter = (options = {}) => {
  const {
    maxRequests = 10, // Default: 10 requests
    windowMs = 60000, // Default: 1 minute
    message = "Too many requests. Please try again later.",
  } = options;

  return (req, res, next) => {
    // Skip rate limiting if user is not authenticated
    if (!req.user || !req.user._id) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();

    // Get or create rate limit data for user
    let userLimit = rateLimitStore.get(userId);

    if (!userLimit || userLimit.resetTime < now) {
      // Create new rate limit entry or reset expired one
      userLimit = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(userId, userLimit);
    }

    // Increment request count
    userLimit.count++;

    // Check if limit exceeded
    if (userLimit.count > maxRequests) {
      const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
      
      logger.warn(`Rate limit exceeded for user ${userId}: ${userLimit.count}/${maxRequests} requests in ${windowMs}ms`);
      
      return sendError(
        res,
        message,
        "Rate Limit Exceeded",
        `Please try again after ${retryAfter} seconds`,
        StatusCodes.TOO_MANY_REQUESTS
      );
    }

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - userLimit.count));
    res.setHeader("X-RateLimit-Reset", new Date(userLimit.resetTime).toISOString());

    next();
  };
};

/**
 * Comment-specific rate limiter
 * Limits: 10 comments per minute
 */
export const commentRateLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  message: "Too many comments. Please wait a moment before commenting again.",
});

export default {
  createRateLimiter,
  commentRateLimiter,
};
