/**
 * Chat Block Service
 * Business logic for chat blocking functionality
 */

import ChatBlock from "../models/chat/ChatBlock.js";
import { User } from "../models/index.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";

/**
 * Block a user from chat
 * @param {string} blockerId - User who is blocking
 * @param {string} blockedUserId - User to be blocked
 * @returns {Promise<Object>} Block record
 */
export const blockUser = async (blockerId, blockedUserId) => {
  try {
    // Validate users exist
    const [blocker, blockedUser] = await Promise.all([
      User.findById(blockerId).select("_id name username"),
      User.findById(blockedUserId).select("_id name username"),
    ]);

    if (!blocker) {
      throw new Error("Blocker user not found");
    }

    if (!blockedUser) {
      throw new Error("User to block not found");
    }

    if (blockerId === blockedUserId) {
      throw new Error("Cannot block yourself");
    }

    const block = await ChatBlock.blockUser(blockerId, blockedUserId);

    logger.info(`User ${blockerId} blocked user ${blockedUserId}`);

    return {
      id: block._id.toString(),
      blocker: {
        id: blocker._id.toString(),
        name: blocker.name,
        username: blocker.username,
      },
      blockedUser: {
        id: blockedUser._id.toString(),
        name: blockedUser.name,
        username: blockedUser.username,
      },
      blockedAt: block.blockedAt,
    };
  } catch (error) {
    logger.error("Error in blockUser:", error);
    throw error;
  }
};

/**
 * Unblock a user from chat
 * @param {string} blockerId - User who blocked
 * @param {string} blockedUserId - User to be unblocked
 * @returns {Promise<boolean>} Success status
 */
export const unblockUser = async (blockerId, blockedUserId) => {
  try {
    // Validate users exist
    const [blocker, blockedUser] = await Promise.all([
      User.findById(blockerId).select("_id name username"),
      User.findById(blockedUserId).select("_id name username"),
    ]);

    if (!blocker) {
      throw new Error("Blocker user not found");
    }

    if (!blockedUser) {
      throw new Error("User to unblock not found");
    }

    await ChatBlock.unblockUser(blockerId, blockedUserId);

    logger.info(`User ${blockerId} unblocked user ${blockedUserId}`);

    return true;
  } catch (error) {
    logger.error("Error in unblockUser:", error);
    throw error;
  }
};

/**
 * Check if user is blocked or has blocked another user
 * @param {string} userId - Current user ID
 * @param {string} otherUserId - Other user ID
 * @returns {Promise<Object>} Block status
 */
export const checkBlockStatus = async (userId, otherUserId) => {
  try {
    const blockStatus = await ChatBlock.isBlocked(userId, otherUserId);
    return blockStatus;
  } catch (error) {
    logger.error("Error in checkBlockStatus:", error);
    throw error;
  }
};

/**
 * Get list of blocked users
 * @param {string} blockerId - User who blocked others
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Blocked users with pagination
 */
export const getBlockedUsers = async (blockerId, options = {}) => {
  try {
    const result = await ChatBlock.getBlockedUsers(blockerId, options);
    return result;
  } catch (error) {
    logger.error("Error in getBlockedUsers:", error);
    throw error;
  }
};

/**
 * Check if message can be sent between two users
 * @param {string} senderId - Sender user ID
 * @param {string} receiverId - Receiver user ID
 * @returns {Promise<Object>} Can send status
 */
export const canSendMessage = async (senderId, receiverId) => {
  try {
    const blockStatus = await ChatBlock.isBlocked(senderId, receiverId);
    
    if (blockStatus.isBlocked) {
      if (blockStatus.blockedBy === "other") {
        // Receiver has blocked sender
        return {
          canSend: false,
          reason: "receiver_blocked",
          message: "You cannot send messages to this user",
        };
      } else {
        // Sender has blocked receiver
        return {
          canSend: false,
          reason: "sender_blocked",
          message: "You have blocked this user",
        };
      }
    }

    return { canSend: true };
  } catch (error) {
    logger.error("Error in canSendMessage:", error);
    throw error;
  }
};

export default {
  blockUser,
  unblockUser,
  checkBlockStatus,
  getBlockedUsers,
  canSendMessage,
};
