/**
 * Mention Parser Utility
 * Extracts @username mentions from text and validates them
 */

import { User } from "../models/index.js";
import logger from "./logger.js";

/**
 * Extract usernames from text (format: @username)
 * @param {string} text - Text containing mentions
 * @returns {Array<string>} Array of unique usernames (without @)
 */
export const extractMentions = (text) => {
  if (!text || typeof text !== "string") {
    return [];
  }

  // Match @username pattern (alphanumeric, underscore, dot, hyphen)
  // Username must start with letter or number, can contain underscore, dot, hyphen
  const mentionRegex = /@([a-zA-Z0-9][a-zA-Z0-9_.-]*)/g;
  const matches = text.match(mentionRegex);

  if (!matches || matches.length === 0) {
    return [];
  }

  // Extract usernames (remove @) and get unique values
  const usernames = [...new Set(matches.map((match) => match.substring(1).toLowerCase()))];

  return usernames;
};

/**
 * Validate and get user IDs for mentioned usernames
 * @param {Array<string>} usernames - Array of usernames (without @)
 * @returns {Promise<Object>} Object with validUserIds and invalidUsernames
 */
export const validateMentions = async (usernames) => {
  if (!usernames || usernames.length === 0) {
    return {
      validUserIds: [],
      invalidUsernames: [],
      userMap: new Map(), // username -> userId mapping
    };
  }

  try {
    // Find users by usernames
    const users = await User.find({
      username: { $in: usernames },
      isDeleted: false,
    }).select("_id username");

    // Create maps for quick lookup
    const userMap = new Map();
    const foundUsernames = new Set();

    users.forEach((user) => {
      userMap.set(user.username.toLowerCase(), user._id.toString());
      foundUsernames.add(user.username.toLowerCase());
    });

    // Find invalid usernames
    const invalidUsernames = usernames.filter(
      (username) => !foundUsernames.has(username.toLowerCase())
    );

    const validUserIds = users.map((user) => user._id.toString());

    return {
      validUserIds,
      invalidUsernames,
      userMap,
    };
  } catch (error) {
    logger.error("Error validating mentions:", error);
    return {
      validUserIds: [],
      invalidUsernames: usernames,
      userMap: new Map(),
    };
  }
};

/**
 * Parse mentions from text and validate them
 * @param {string} text - Text containing mentions
 * @returns {Promise<Object>} Object with mentionedUserIds and invalidUsernames
 */
export const parseAndValidateMentions = async (text) => {
  const usernames = extractMentions(text);
  const { validUserIds, invalidUsernames, userMap } = await validateMentions(usernames);

  return {
    mentionedUserIds: validUserIds,
    invalidUsernames,
    userMap,
  };
};

export default {
  extractMentions,
  validateMentions,
  parseAndValidateMentions,
};
