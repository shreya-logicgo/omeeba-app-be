import Poll from "../models/content/Poll.js";
import User from "../models/users/User.js";
import { PollStatus } from "../models/enums.js";
import logger from "../utils/logger.js";
import { extractHashtags, linkHashtagsToContent } from "./hashtag.service.js";

const POLL_CONTENT_TYPE = "Poll";

/**
 * Create Poll
 * @param {string} userId - User ID
 * @param {Object} pollData - Poll data (caption, options, duration)
 * @returns {Promise<Object>} Created poll
 */
export const createPoll = async (userId, pollData) => {
  try {
    // Verify user exists and is not deleted
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Validate options
    if (!pollData.options || pollData.options.length < 2) {
      throw new Error("At least 2 options are required");
    }

    if (pollData.options.length > 10) {
      throw new Error("Cannot have more than 10 options");
    }

    // Validate duration is in the future
    const duration = new Date(pollData.duration);
    if (duration <= new Date()) {
      throw new Error("Duration must be in the future");
    }

    // Generate unique option IDs
    const options = pollData.options.map((optionText, index) => ({
      optionId: `option_${Date.now()}_${index}`,
      optionText: optionText.trim(),
      voteCount: 0,
      votePercentage: 0,
    }));

    // Create poll
    const poll = new Poll({
      createdBy: userId,
      caption: pollData.caption.trim(),
      options: options,
      duration: duration,
      status: PollStatus.ACTIVE,
      totalVotes: 0,
      userVotes: [],
    });

    await poll.save();

    // Link hashtags to content (async, don't wait)
    if (pollData.caption) {
      const tags = extractHashtags(pollData.caption);
      if (tags.length > 0) {
        linkHashtagsToContent(POLL_CONTENT_TYPE, poll._id, tags).catch(
          (error) => {
            logger.error(`Error linking hashtags for poll ${poll._id}:`, error);
          }
        );
      }
    }

    // Populate createdBy
    await poll.populate({
      path: "createdBy",
      select: "name username profileImage email isAccountVerified isVerifiedBadge",
    });

    logger.info(`Poll created: ${poll._id} by user: ${userId}`);

    return poll;
  } catch (error) {
    logger.error("Error in createPoll:", error);
    throw error;
  }
};

/**
 * Vote on Poll
 * @param {string} userId - User ID
 * @param {string} pollId - Poll ID
 * @param {string} optionId - Option ID to vote for
 * @returns {Promise<Object>} Updated poll
 */
export const votePoll = async (userId, pollId, optionId) => {
  try {
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Find poll
    const poll = await Poll.findById(pollId);
    if (!poll) {
      throw new Error("Poll not found");
    }

    // Check if poll is still active
    if (poll.status !== PollStatus.ACTIVE) {
      throw new Error("Poll has expired");
    }

    // Check if duration has passed
    if (new Date() >= poll.duration) {
      // Auto-calculate results
      await calculatePollResults(pollId);
      throw new Error("Poll has expired");
    }

    // Check if user has already voted
    const existingVote = poll.userVotes.find(
      (vote) => vote.userId.toString() === userId.toString()
    );

    if (existingVote) {
      // User has already voted, update their vote
      const oldOptionId = existingVote.optionId;

      // Decrease vote count for old option
      const oldOption = poll.options.find(
        (opt) => opt.optionId === oldOptionId
      );
      if (oldOption) {
        oldOption.voteCount = Math.max(0, oldOption.voteCount - 1);
      }

      // Update to new option
      existingVote.optionId = optionId;
    } else {
      // Add new vote
      poll.userVotes.push({
        userId: userId,
        optionId: optionId,
      });
    }

    // Validate option exists
    const selectedOption = poll.options.find(
      (opt) => opt.optionId === optionId
    );
    if (!selectedOption) {
      throw new Error("Invalid option ID");
    }

    // Increase vote count for selected option
    selectedOption.voteCount += 1;

    // Update total votes
    poll.totalVotes = poll.userVotes.length;

    // Calculate percentages
    calculatePercentages(poll);

    await poll.save();

    // Populate createdBy
    await poll.populate({
      path: "createdBy",
      select: "name username profileImage email isAccountVerified isVerifiedBadge",
    });

    logger.info(`User ${userId} voted on poll ${pollId} for option ${optionId}`);

    return poll;
  } catch (error) {
    logger.error("Error in votePoll:", error);
    throw error;
  }
};

/**
 * Get Poll by ID
 * @param {string} pollId - Poll ID
 * @param {string} userId - Optional user ID to check if user has voted
 * @returns {Promise<Object>} Poll
 */
export const getPoll = async (pollId, userId = null) => {
  try {
    const poll = await Poll.findById(pollId).populate({
      path: "createdBy",
      select: "name username profileImage email isAccountVerified isVerifiedBadge",
    });

    if (!poll) {
      throw new Error("Poll not found");
    }

    // Check if poll has expired and calculate results if needed
    if (poll.status === PollStatus.ACTIVE && new Date() >= poll.duration) {
      await calculatePollResults(pollId);
      // Reload poll to get updated results
      const updatedPoll = await Poll.findById(pollId).populate({
        path: "createdBy",
        select: "name username profileImage email isAccountVerified isVerifiedBadge",
      });
      if (updatedPoll) {
        poll = updatedPoll;
      }
    }

    // Check if user has voted (if userId provided)
    let userVote = null;
    if (userId) {
      const vote = poll.userVotes.find(
        (v) => v.userId.toString() === userId.toString()
      );
      if (vote) {
        userVote = vote.optionId;
      }
    }

    return {
      poll,
      userVote,
    };
  } catch (error) {
    logger.error("Error in getPoll:", error);
    throw error;
  }
};

/**
 * Calculate poll results (percentages)
 * @param {Object} poll - Poll document
 */
const calculatePercentages = (poll) => {
  const totalVotes = poll.totalVotes || 0;

  if (totalVotes === 0) {
    // No votes, set all percentages to 0
    poll.options.forEach((option) => {
      option.votePercentage = 0;
    });
    return;
  }

  // Calculate percentage for each option
  poll.options.forEach((option) => {
    option.votePercentage = Math.round((option.voteCount / totalVotes) * 100);
  });
};

/**
 * Calculate and finalize poll results when duration expires
 * @param {string} pollId - Poll ID
 * @returns {Promise<Object>} Updated poll
 */
export const calculatePollResults = async (pollId) => {
  try {
    const poll = await Poll.findById(pollId);

    if (!poll) {
      logger.warn(`Poll not found for result calculation: ${pollId}`);
      return null;
    }

    // Check if already expired
    if (poll.status === PollStatus.EXPIRED) {
      return poll;
    }

    // Check if duration has passed
    if (new Date() < poll.duration) {
      // Duration hasn't passed yet
      return poll;
    }

    // Calculate percentages
    calculatePercentages(poll);

    // Update status to expired
    poll.status = PollStatus.EXPIRED;
    poll.updatedAt = new Date();

    await poll.save();

    logger.info(`Poll results calculated for poll: ${pollId}`);

    return poll;
  } catch (error) {
    logger.error("Error in calculatePollResults:", error);
    throw error;
  }
};

/**
 * Get all expired polls that need result calculation
 * @returns {Promise<Array>} Array of poll IDs
 */
export const getExpiredPolls = async () => {
  try {
    const now = new Date();
    const expiredPolls = await Poll.find({
      status: PollStatus.ACTIVE,
      duration: { $lte: now },
    }).select("_id");

    return expiredPolls.map((poll) => poll._id.toString());
  } catch (error) {
    logger.error("Error in getExpiredPolls:", error);
    throw error;
  }
};

export default {
  createPoll,
  votePoll,
  getPoll,
  calculatePollResults,
  getExpiredPolls,
};

