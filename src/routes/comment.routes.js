/**
 * Comment Routes
 * API routes for comment operations
 */

import express from "express";
import { protect } from "../middleware/auth.js";
import { commentRateLimiter } from "../middleware/rateLimiter.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validator.js";
import { createCommentBodySchema } from "../validators/comment.validator.js";
import { commentIdParamsSchema } from "../validators/commentLike.validator.js";
import {
  createReplyBodySchema,
  getRepliesQuerySchema,
  replyIdParamsSchema,
} from "../validators/commentReply.validator.js";
import { getCommentsQuerySchema } from "../validators/commentListing.validator.js";
import { reportCommentBodySchema } from "../validators/commentReport.validator.js";
import { createComment } from "../controllers/comment.controller.js";
import { toggleLike } from "../controllers/commentLike.controller.js";
import { toggleReplyLike } from "../controllers/replyCommentLike.controller.js";
import {
  createReplyHandler,
  getRepliesHandler,
  deleteReplyHandler,
  createReplyToReplyHandler,
  getRepliesToReplyHandler,
} from "../controllers/commentReply.controller.js";
import { deleteCommentHandler } from "../controllers/commentDeletion.controller.js";
import { reportCommentHandler, reportReplyCommentHandler } from "../controllers/commentReport.controller.js";
import { getCommentsHandler, getCommentByIdHandler } from "../controllers/commentListing.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v1/comments
 * @desc    Get comments for content with pagination
 * @access  Private
 */
router.get(
  "/",
  protect,
  validateQuery(getCommentsQuerySchema),
  getCommentsHandler
);

/**
 * @route   POST /api/v1/comments
 * @desc    Create a comment on content (post, write post, zeal)
 * @access  Private
 * @rateLimit 10 requests per minute per user
 */
router.post(
  "/",
  protect,
  commentRateLimiter,
  validateBody(createCommentBodySchema),
  createComment
);

/**
 * @route   GET /api/v1/comments/:commentId
 * @desc    Get a single comment by ID
 * @access  Private
 */
router.get(
  "/:commentId",
  protect,
  validateParams(commentIdParamsSchema),
  getCommentByIdHandler
);

/**
 * @route   DELETE /api/v1/comments/:commentId
 * @desc    Delete a comment (soft delete - only own comments)
 * @access  Private
 */
router.delete(
  "/:commentId",
  protect,
  validateParams(commentIdParamsSchema),
  deleteCommentHandler
);

/**
 * @route   POST /api/v1/comments/:commentId/like
 * @desc    Toggle like on a comment (like if not liked, unlike if already liked)
 * @access  Private
 */
router.post(
  "/:commentId/like",
  protect,
  validateParams(commentIdParamsSchema),
  toggleLike
);

/**
 * @route   POST /api/v1/comments/:commentId/report
 * @desc    Report a comment
 * @access  Private
 */
router.post(
  "/:commentId/report",
  protect,
  validateParams(commentIdParamsSchema),
  validateBody(reportCommentBodySchema),
  reportCommentHandler
);

/**
 * @route   POST /api/v1/comments/replies/:replyId/report
 * @desc    Report a reply comment
 * @access  Private
 */
router.post(
  "/replies/:replyId/report",
  protect,
  validateParams(replyIdParamsSchema),
  validateBody(reportCommentBodySchema),
  reportReplyCommentHandler
);

/**
 * @route   GET /api/v1/comments/:commentId/replies
 * @desc    Get replies for a comment with pagination
 * @access  Private
 */
router.get(
  "/:commentId/replies",
  protect,
  validateParams(commentIdParamsSchema),
  validateQuery(getRepliesQuerySchema),
  getRepliesHandler
);

/**
 * @route   POST /api/v1/comments/:commentId/replies
 * @desc    Create a reply to a comment
 * @access  Private
 * @rateLimit 10 requests per minute per user
 */
router.post(
  "/:commentId/replies",
  protect,
  commentRateLimiter,
  validateParams(commentIdParamsSchema),
  validateBody(createReplyBodySchema),
  createReplyHandler
);

/**
 * @route   POST /api/v1/comments/replies/:replyId/like
 * @desc    Toggle like on a reply comment (like if not liked, unlike if already liked)
 * @access  Private
 */
router.post(
  "/replies/:replyId/like",
  protect,
  validateParams(replyIdParamsSchema),
  toggleReplyLike
);

/**
 * @route   DELETE /api/v1/comments/replies/:replyId
 * @desc    Delete a reply (soft delete - only own replies)
 * @access  Private
 */
router.delete(
  "/replies/:replyId",
  protect,
  validateParams(replyIdParamsSchema),
  deleteReplyHandler
);

/**
 * @route   GET /api/v1/comments/replies/:replyId/replies
 * @desc    Get nested replies (replies to a reply) with pagination
 * @access  Private
 */
router.get(
  "/replies/:replyId/replies",
  protect,
  validateParams(replyIdParamsSchema),
  validateQuery(getRepliesQuerySchema),
  getRepliesToReplyHandler
);

/**
 * @route   POST /api/v1/comments/replies/:replyId/replies
 * @desc    Create a reply to a reply (nested reply)
 * @access  Private
 * @rateLimit 10 requests per minute per user
 */
router.post(
  "/replies/:replyId/replies",
  protect,
  commentRateLimiter,
  validateParams(replyIdParamsSchema),
  validateBody(createReplyBodySchema),
  createReplyToReplyHandler
);

export default router;
