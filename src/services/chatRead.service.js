/**
 * Chat Read/Unread Service
 * Business logic for managing read/unread status
 */

import mongoose from "mongoose";
import ChatParticipant from "../models/chat/ChatParticipant.js";
import ChatMessage from "../models/chat/ChatMessage.js";
import ChatRoom from "../models/chat/ChatRoom.js";
import { MessageStatus } from "../models/enums.js";
import logger from "../utils/logger.js";

/**
 * Mark messages as read in a chat room
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID
 * @param {string} lastReadMessageId - Last read message ID (optional)
 * @returns {Promise<Object>} Updated read status
 */
export const markMessagesAsRead = async (roomId, userId, lastReadMessageId = null) => {
  try {
    // Verify room exists and user is a participant
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
    });

    if (!room) {
      throw new Error("Chat room not found or access denied");
    }

    // If lastReadMessageId is provided, verify it exists and belongs to this room
    let lastReadMessage = null;
    if (lastReadMessageId) {
      lastReadMessage = await ChatMessage.findOne({
        _id: lastReadMessageId,
        roomId,
      });

      if (!lastReadMessage) {
        throw new Error("Message not found");
      }
    } else {
      // Get the latest message in the room
      lastReadMessage = await ChatMessage.findOne({ roomId })
        .sort({ createdAt: -1 })
        .lean();
    }

    // Update or create participant record
    const participant = await ChatParticipant.findOneAndUpdate(
      { roomId, userId },
      {
        lastReadMessageId: lastReadMessage ? lastReadMessage._id : null,
        lastReadAt: new Date(),
        unreadCount: 0, // Reset unread count
      },
      { upsert: true, new: true }
    );

    // Update message status to SEEN for messages sent by other user
    if (lastReadMessage) {
      const otherUserId = room.userA.toString() === userId ? room.userB : room.userA;
      
      // Update all messages from other user in this room to SEEN status
      // Only update messages that are DELIVERED or SENT (not already SEEN)
      await ChatMessage.updateMany(
        {
          roomId,
          senderId: otherUserId,
          status: { $in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
          createdAt: { $lte: lastReadMessage.createdAt },
        },
        {
          status: MessageStatus.SEEN,
        }
      );
    }

    logger.info(`Messages marked as read in room ${roomId} by user ${userId}`);

    return {
      roomId: roomId.toString(),
      userId: userId.toString(),
      lastReadMessageId: participant.lastReadMessageId ? participant.lastReadMessageId.toString() : null,
      lastReadAt: participant.lastReadAt,
      unreadCount: participant.unreadCount,
    };
  } catch (error) {
    logger.error("Error in markMessagesAsRead:", error);
    throw error;
  }
};

/**
 * Get unread count for a specific room
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID
 * @returns {Promise<number>} Unread count
 */
export const getUnreadCount = async (roomId, userId) => {
  try {
    const participant = await ChatParticipant.findOne({
      roomId,
      userId,
    });

    return participant ? participant.unreadCount : 0;
  } catch (error) {
    logger.error("Error in getUnreadCount:", error);
    throw error;
  }
};

/**
 * Get total unread count across all rooms for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Total unread count
 */
export const getTotalUnreadCount = async (userId) => {
  try {
    const result = await ChatParticipant.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: "$unreadCount" } } },
    ]);

    return result.length > 0 ? result[0].total : 0;
  } catch (error) {
    logger.error("Error in getTotalUnreadCount:", error);
    throw error;
  }
};

export default {
  markMessagesAsRead,
  getUnreadCount,
  getTotalUnreadCount,
};
