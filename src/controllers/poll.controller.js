import {
  createPoll as createPollService,
  votePoll as votePollService,
  getPoll as getPollService,
} from "../services/poll.service.js";
import { deletePoll as deletePollService } from "../services/contentDeletion.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound, sendForbidden } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create Poll
 * @route POST /api/v1/polls
 * @access Private
 */
export const createPoll = async (req, res) => {
  try {
    const userId = req.user._id;
    const pollData = req.body;

    // Create poll
    const poll = await createPollService(userId, pollData);

    // Format response
    return sendSuccess(
      res,
      {
        poll: {
          id: poll._id,
          caption: poll.caption,
          options: poll.options.map((option) => ({
            optionId: option.optionId,
            optionText: option.optionText,
            voteCount: option.voteCount,
            votePercentage: option.votePercentage,
            selectedByAuthUser: false,
          })),
          totalVotes: poll.totalVotes,
          status: poll.status,
          duration: poll.duration,
          createdBy: {
            id: poll.createdBy._id,
            name: poll.createdBy.name,
            username: poll.createdBy.username,
            profileImage: poll.createdBy.profileImage,
            isAccountVerified: poll.createdBy.isAccountVerified,
            isVerifiedBadge: poll.createdBy.isVerifiedBadge,
          },
          createdAt: poll.createdAt,
          updatedAt: poll.updatedAt,
        },
      },
      "Poll created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create poll error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to create poll",
      "Create Poll Error",
      error.message || "An error occurred while creating poll",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Vote on Poll
 * @route POST /api/v1/polls/:pollId/vote
 * @access Private
 */
export const votePoll = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pollId } = req.params;
    const { optionId } = req.body;

    // Vote on poll
    const poll = await votePollService(userId, pollId, optionId);

    // Format response with selectedByAuthUser on each option (user just voted)
    const userSelectedOptionId = poll.userVotes?.find(
      (v) => v.userId.toString() === userId.toString()
    )?.optionId ?? null;
    return sendSuccess(
      res,
      {
        poll: {
          id: poll._id,
          caption: poll.caption,
          options: poll.options.map((option) => ({
            optionId: option.optionId,
            optionText: option.optionText,
            voteCount: option.voteCount,
            votePercentage: option.votePercentage,
            selectedByAuthUser:
              userSelectedOptionId != null &&
              option.optionId === userSelectedOptionId,
          })),
          totalVotes: poll.totalVotes,
          status: poll.status,
          duration: poll.duration,
          createdBy: {
            id: poll.createdBy._id,
            name: poll.createdBy.name,
            username: poll.createdBy.username,
            profileImage: poll.createdBy.profileImage,
            isAccountVerified: poll.createdBy.isAccountVerified,
            isVerifiedBadge: poll.createdBy.isVerifiedBadge,
          },
          createdAt: poll.createdAt,
          updatedAt: poll.updatedAt,
        },
      },
      "Vote recorded successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Vote poll error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to vote on poll",
      "Vote Poll Error",
      error.message || "An error occurred while voting on poll",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Poll
 * @route GET /api/v1/polls/:pollId
 * @access Private
 */
export const getPoll = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pollId } = req.params;

    // Get poll
    const { poll, userVote } = await getPollService(pollId, userId);

    // Format response with selectedByAuthUser on each option
    return sendSuccess(
      res,
      {
        poll: {
          id: poll._id,
          caption: poll.caption,
          options: poll.options.map((option) => ({
            optionId: option.optionId,
            optionText: option.optionText,
            voteCount: option.voteCount,
            votePercentage: option.votePercentage,
            selectedByAuthUser:
              userVote != null && option.optionId === userVote,
          })),
          totalVotes: poll.totalVotes,
          status: poll.status,
          duration: poll.duration,
          createdBy: {
            id: poll.createdBy._id,
            name: poll.createdBy.name,
            username: poll.createdBy.username,
            profileImage: poll.createdBy.profileImage,
            isAccountVerified: poll.createdBy.isAccountVerified,
            isVerifiedBadge: poll.createdBy.isVerifiedBadge,
          },
          createdAt: poll.createdAt,
          updatedAt: poll.updatedAt,
        },
      },
      "Poll retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get poll error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get poll",
      "Get Poll Error",
      error.message || "An error occurred while retrieving poll",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Delete Poll
 * @route DELETE /api/v1/polls/:pollId
 * @access Private
 */
export const deletePoll = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { pollId } = req.params;
    const result = await deletePollService(userId, pollId);
    return sendSuccess(res, result, "Poll deleted successfully", StatusCodes.OK);
  } catch (error) {
    logger.error("Delete poll error:", error);
    if (error.message === "Poll not found" || error.message === "User not found") {
      return sendNotFound(res, error.message);
    }
    if (error.message === "You can only delete your own polls") {
      return sendForbidden(res, error.message);
    }
    if (error.message) return sendBadRequest(res, error.message);
    return sendError(
      res,
      "Failed to delete poll",
      "Delete Poll Error",
      error.message || "An error occurred while deleting poll",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  createPoll,
  votePoll,
  getPoll,
  deletePoll,
};
