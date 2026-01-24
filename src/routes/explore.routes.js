import express from "express";
import { optionalProtect } from "../middleware/auth.js";
import { validateQuery } from "../utils/validation.js";
import {
  getTrending,
  search,
  getHashtagContent,
} from "../controllers/explore.controller.js";
import {
  getTrendingSchema,
  searchSchema,
  getHashtagContentSchema,
} from "../validators/explore.validator.js";

const router = express.Router();

/**
 * @route   GET /api/v1/explore/trending
 * @desc    Get trending/popular content for Explore landing screen
 * @access  Public (optional auth - works without auth but filters better with auth)
 * @query   contentType - Filter by type: 'all', 'post', 'write', 'zeal' (default: 'all')
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get(
  "/trending",
  optionalProtect, // Optional auth - attaches user if token provided, but doesn't fail if missing
  validateQuery(getTrendingSchema),
  getTrending
);

/**
 * @route   GET /api/v1/explore/search
 * @desc    Simplified search with specific types (no pagination, max 15 items)
 * @access  Public (optional auth - works without auth but filters better with auth)
 * @query   query - Search query (optional, can be empty)
 * @query   type - Filter by type (required)
 *                - 'explore': Search zeals and posts (use contentType to filter: 'zeal' or 'post')
 *                - 'trending': Search only write posts
 *                - 'polls': Search only polls (status: ACTIVE)
 *                - 'users': Search users by username or name
 *                - 'hashtag': Search hashtags (returns tag + contentCount)
 * @query   contentType - For explore type only: 'zeal' or 'post' (optional)
 * 
 * @filter_details
 * Type-specific filters:
 * - explore: ZealPost.caption (PUBLISHED/READY) + Post.caption
 *            Use contentType='zeal' for only zeals, contentType='post' for only posts
 * - trending: WritePost.content (text index)
 * - polls: Poll.caption (text index, status: ACTIVE)
 * - users: User.name, User.username (case-insensitive regex)
 * - hashtag: Hashtag.tag (case-insensitive regex, returns contentCount)
 * 
 * Base filters applied:
 * - Excludes deleted users (isDeleted: false)
 * - Excludes blocked users (if authenticated)
 * - Excludes reported content (if authenticated)
 * - Fixed limit: 15 items per type
 * - No pagination
 */
router.get(
  "/search",
  optionalProtect,
  validateQuery(searchSchema),
  search
);

/**
 * @route   GET /api/v1/explore/hashtag/:hashtag
 * @desc    Get content associated with a specific hashtag
 * @access  Public (optional auth - works without auth but filters better with auth)
 * @param   hashtag - Hashtag (with or without # prefix)
 * @query   contentType - Filter by type: 'all', 'post', 'write', 'zeal', 'poll' (default: 'all')
 * @query   sortBy - Sort by: 'relevance', 'popularity', 'recent' (default: 'popularity')
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get(
  "/hashtag/:hashtag",
  optionalProtect,
  validateQuery(getHashtagContentSchema),
  getHashtagContent
);

export default router;

