import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody, validateParams } from "../utils/validation.js";
import {
  createPollSchema,
  votePollSchema,
} from "../validators/poll.validator.js";
import {
  createPoll,
  votePoll,
  getPoll,
  deletePoll,
} from "../controllers/poll.controller.js";
import Joi from "joi";
import { createSchema } from "../utils/validation.js";
import { deletePollParamsSchema } from "../validators/poll.validator.js";

const router = express.Router();

// Poll ID validation schema (for vote and get)
const pollIdSchema = createSchema({
  pollId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "must be a valid poll ID",
      "any.required": "Poll ID is required",
    }),
});

/**
 * @route   POST /api/v1/polls
 * @desc    Create a new poll
 * @access  Private
 */
router.post("/", protect, validateBody(createPollSchema), createPoll);

/**
 * @route   GET /api/v1/polls/:pollId
 * @desc    Get a poll by ID
 * @access  Private
 */
router.get("/:pollId", protect, validateParams(pollIdSchema), getPoll);

/**
 * @route   POST /api/v1/polls/:pollId/vote
 * @desc    Vote on a poll
 * @access  Private
 */
router.post(
  "/:pollId/vote",
  protect,
  validateParams(pollIdSchema),
  validateBody(votePollSchema),
  votePoll
);

/**
 * @route   DELETE /api/v1/polls/:pollId
 * @desc    Delete a poll (creator only)
 * @access  Private
 */
router.delete(
  "/:pollId",
  protect,
  validateParams(deletePollParamsSchema),
  deletePoll
);

export default router;

