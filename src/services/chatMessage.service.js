/**
 * Chat Message Service
 * Business logic for chat message operations
 */

import ChatMessage from "../models/chat/ChatMessage.js";
import ChatRoom from "../models/chat/ChatRoom.js";
import ChatParticipant from "../models/chat/ChatParticipant.js";
import { User } from "../models/index.js";
import { MessageType, MessageStatus } from "../models/enums.js";
import { getTimeAgo } from "../utils/timeAgo.js";
import { formatTime12Hour } from "../utils/timeFormatter.js";
import logger from "../utils/logger.js";

/**
 * Send a message in a chat room
 * @param {string} roomId - Room ID
 * @param {string} senderId - Sender user ID
 * @param {Object} messageData - Message data
 * @returns {Promise<Object>} Created message
 */
export const sendMessage = async (roomId, senderId, messageData) => {
  try {
    const { messageType, message, mediaUrl, thumbnailUrl, contentId, contentType } = messageData;

    // Verify room exists and user is a participant
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: senderId }, { userB: senderId }],
    });

    if (!room) {
      throw new Error("Chat room not found or access denied");
    }

    if (room.isBlocked) {
      throw new Error("Chat room is blocked");
    }

    // Create message
    const newMessage = await ChatMessage.create({
      roomId,
      senderId,
      messageType,
      message: message || null,
      mediaUrl: mediaUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      contentId: contentId || null,
      contentType: contentType || null,
      status: MessageStatus.SENT,
    });

    // Update room's last message
    room.lastMessage = message || (messageType === MessageType.IMAGE ? "📷 Image" : messageType === MessageType.SNAP ? "📸 Snap" : null);
    room.lastMessageType = messageType;
    room.lastMessageAt = newMessage.createdAt;
    await room.save();

    // Update unread counts (increment for other user, reset for sender)
    const otherUserId = room.userA.toString() === senderId ? room.userB : room.userA;
    
    await Promise.all([
      // Increment unread count for other user
      ChatParticipant.findOneAndUpdate(
        { roomId, userId: otherUserId },
        { $inc: { unreadCount: 1 } },
        { upsert: true, new: true }
      ),
      // Reset unread count for sender (they've seen their own message)
      ChatParticipant.findOneAndUpdate(
        { roomId, userId: senderId },
        { 
          unreadCount: 0,
          lastReadMessageId: newMessage._id,
          lastReadAt: new Date(),
        },
        { upsert: true, new: true }
      ),
    ]);

    // Populate sender info
    await newMessage.populate("senderId", "name username profileImage bio isVerifiedBadge");

    // Format response
    const formattedMessage = {
      id: newMessage._id.toString(),
      roomId: roomId.toString(),
      sender: {
        id: newMessage.senderId._id.toString(),
        name: newMessage.senderId.name,
        username: newMessage.senderId.username,
        profileImage: newMessage.senderId.profileImage,
        bio: newMessage.senderId.bio,
        isVerifiedBadge: newMessage.senderId.isVerifiedBadge,
      },
      messageType: newMessage.messageType,
      message: newMessage.message,
      mediaUrl: newMessage.mediaUrl,
      thumbnailUrl: newMessage.thumbnailUrl,
      contentId: newMessage.contentId ? newMessage.contentId.toString() : null,
      contentType: newMessage.contentType,
      status: newMessage.status,
      statusDisplay: newMessage.status === MessageStatus.SEEN ? "seen" : 
                     newMessage.status === MessageStatus.DELIVERED ? "delivered" : "sent",
      timestamp: formatTime12Hour(newMessage.createdAt), // 12-hour format "11:02 AM"
      timeAgo: getTimeAgo(newMessage.createdAt), // Keep for backward compatibility
      createdAt: newMessage.createdAt,
    };

    logger.info(`Message sent in room ${roomId} by user ${senderId}`);

    return formattedMessage;
  } catch (error) {
    logger.error("Error in sendMessage:", error);
    throw error;
  }
};

/**
 * Get messages for a chat room with pagination
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID (to verify access)
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Messages with pagination
 */
export const getMessages = async (roomId, userId, page = 1, limit = 50) => {
  try {
    const skip = (page - 1) * limit;

    // Verify room exists and user is a participant
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
    });

    if (!room) {
      throw new Error("Chat room not found or access denied");
    }

    // Fetch messages (oldest first for pagination, then reverse for display)
    const messages = await ChatMessage.find({ roomId })
      .populate("senderId", "name username profileImage bio isVerifiedBadge")
      .sort({ createdAt: -1 }) // Newest first
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ChatMessage.countDocuments({ roomId });

    // Format messages
    const formattedMessages = messages.map((msg) => ({
      id: msg._id.toString(),
      roomId: roomId.toString(),
      sender: {
        id: msg.senderId._id.toString(),
        name: msg.senderId.name,
        username: msg.senderId.username,
        profileImage: msg.senderId.profileImage,
        bio: msg.senderId.bio,
        isVerifiedBadge: msg.senderId.isVerifiedBadge,
      },
      messageType: msg.messageType,
      message: msg.message,
      mediaUrl: msg.mediaUrl,
      thumbnailUrl: msg.thumbnailUrl,
      contentId: msg.contentId ? msg.contentId.toString() : null,
      contentType: msg.contentType,
      status: msg.status,
      statusDisplay: msg.status === MessageStatus.SEEN ? "seen" : 
                     msg.status === MessageStatus.DELIVERED ? "delivered" : "sent", // For UI display
      timestamp: formatTime12Hour(msg.createdAt), // 12-hour format "11:02 AM"
      timeAgo: getTimeAgo(msg.createdAt), // Keep for backward compatibility
      createdAt: msg.createdAt,
    }));

    return {
      messages: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error in getMessages:", error);
    throw error;
  }
};

export default {
  sendMessage,
  getMessages,
};
