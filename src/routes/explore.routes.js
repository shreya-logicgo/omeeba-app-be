import express from "express";
import { optionalProtect } from "../middleware/auth.js";
import { validateBody, validateQuery } from "../utils/validation.js";
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
 * @route   GET /api/v1/explore
 * @desc    Get trending/popular content for Explore landing screen
 * @access  Public (optional auth - works without auth but filters better with auth)
 * @query   contentType - Filter by type: 'all', 'post', 'write', 'zeal', 'poll', 'explore' (default: 'all')
 *                        'explore' returns mixed zeals and posts
 * @query   page - Page number (default: 1)
 * @query   limit - Items per page (default: 20)
 */
router.get(
  "/",
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
 *                - 'posts': Search only posts (searches captions, username, name)
 *                - 'zeals': Search only zeals (searches captions, username, name)
 *                - 'trending': Search only write posts
 *                - 'polls': Search only polls (status: ACTIVE)
 *                - 'users': Search users by username or name
 *                - 'hashtag': Search hashtags (returns tag + contentCount)
 * @query   contentType - Filter search results (optional)
 *                - For 'explore' type: 'post' (searches captions, username, name) or 'zeal' (searches captions, username, name)
 *                - For 'users' type: 'users' (searches username, name)
 *                - For 'hashtag' type: 'hashtag' (searches tag)
 *                - Note: 'posts' and 'zeals' types automatically set contentType, so this parameter is ignored
 * 
 * @filter_details
 * Type-specific filters:
 * - explore: Searches in ZealPost.caption + Post.caption + User.username + User.name
 *            Use contentType='zeal' for only zeals, contentType='post' for only posts
 *            When searching, matches caption OR username/name
 * - posts: Searches in Post.caption + User.username + User.name
 *          When searching, matches caption OR username/name
 * - zeals: Searches in ZealPost.caption + User.username + User.name
 *          When searching, matches caption OR username/name
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
router.post(
  "/search",
  optionalProtect,
  validateBody(searchSchema),
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

