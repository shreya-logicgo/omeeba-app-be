/**
 * Chat Room Service
 * Business logic for chat room operations
 */

import mongoose from "mongoose";
import ChatRoom from "../models/chat/ChatRoom.js";
import ChatMessage from "../models/chat/ChatMessage.js";
import ChatParticipant from "../models/chat/ChatParticipant.js";
import UserFollower from "../models/users/UserFollower.js";
import { User } from "../models/index.js";
import { ChatType, MessageType, MessageStatus } from "../models/enums.js";
import { getTimeAgo } from "../utils/timeAgo.js";
import { formatChatListTime } from "../utils/timeFormatter.js";
import logger from "../utils/logger.js";

/**
 * Get or create a chat room between two users
 * @param {string} userAId - First user ID
 * @param {string} userBId - Second user ID
 * @param {string} chatType - Chat type (DIRECT or REQUEST)
 * @returns {Promise<Object>} Chat room
 */
export const getOrCreateChatRoom = async (userAId, userBId, chatType = ChatType.DIRECT) => {
  try {
    // Ensure consistent ordering (smaller ID first)
    const [userA, userB] = [userAId, userBId].sort();

    // Try to find existing room
    let room = await ChatRoom.findOne({
      userA,
      userB,
    });

    if (!room) {
      // Create new room
      room = await ChatRoom.create({
        userA,
        userB,
        chatType,
      });

      // Create participant records for both users
      await Promise.all([
        ChatParticipant.create({
          roomId: room._id,
          userId: userA,
          unreadCount: 0,
        }),
        ChatParticipant.create({
          roomId: room._id,
          userId: userB,
          unreadCount: 0,
        }),
      ]);

      logger.info(`Created chat room ${room._id} between users ${userA} and ${userB}`);
    }

    // Format and return room with participant info
    await room.populate("userA", "name username profileImage bio isVerifiedBadge");
    await room.populate("userB", "name username profileImage bio isVerifiedBadge");

    const roomId = room._id.toString();
    const otherUser = room.userA._id.toString() === userAId ? room.userB : room.userA;
    const otherUserId = otherUser._id.toString();

    // Get followers count
    const followersCount = await UserFollower.countDocuments({ userId: otherUserId });

    return {
      id: roomId,
      roomId: roomId, // Also include as roomId for clarity
      chatType: room.chatType,
      otherUser: {
        id: otherUserId,
        name: otherUser.name,
        username: otherUser.username,
        profileImage: otherUser.profileImage,
        bio: otherUser.bio,
        isVerifiedBadge: otherUser.isVerifiedBadge,
        followersCount: followersCount, // Add followers count
      },
      isBlocked: room.isBlocked,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  } catch (error) {
    logger.error("Error in getOrCreateChatRoom:", error);
    throw error;
  }
};

/**
 * Get chat room list for a user (inbox)
 * @param {string} userId - User ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Chat rooms with pagination
 */
export const getChatRooms = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    // Find all rooms where user is either userA or userB
    const rooms = await ChatRoom.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .populate("userA", "name username profileImage bio isVerifiedBadge")
      .populate("userB", "name username profileImage bio isVerifiedBadge")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ChatRoom.countDocuments({
      $or: [{ userA: userId }, { userB: userId }],
    });

    // Get participant data (unread counts) for each room
    const roomIds = rooms.map((room) => room._id.toString());
    const participants = await ChatParticipant.find({
      roomId: { $in: roomIds },
      userId,
    }).lean();

    const participantMap = new Map();
    participants.forEach((p) => {
      participantMap.set(p.roomId.toString(), p);
    });

    // Get last message for each room to determine sender and status
    const lastMessages = await ChatMessage.aggregate([
      { $match: { roomId: { $in: roomIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$roomId", lastMessage: { $first: "$$ROOT" } } },
    ]);

    const lastMessageMap = new Map();
    lastMessages.forEach((item) => {
      lastMessageMap.set(item._id.toString(), item.lastMessage);
    });

    // Get followers count for all other users
    const otherUserIds = rooms.map((room) => {
      const otherUser = room.userA._id.toString() === userId ? room.userB : room.userA;
      return otherUser._id.toString();
    });

    const followersCounts = otherUserIds.length > 0 ? await UserFollower.aggregate([
      { $match: { userId: { $in: otherUserIds.map(id => new mongoose.Types.ObjectId(id)) } } },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]) : [];

    const followersMap = new Map();
    followersCounts.forEach((item) => {
      followersMap.set(item._id.toString(), item.count);
    });

    // Format rooms
    const formattedRooms = rooms.map((room) => {
      const roomId = room._id.toString();
      const participant = participantMap.get(roomId);
      const otherUser = room.userA._id.toString() === userId ? room.userB : room.userA;
      const otherUserId = otherUser._id.toString();

      // Get followers count
      const followersCount = followersMap.get(otherUserId) || 0;

      // Get last message details
      const lastMessage = lastMessageMap.get(roomId);
      const lastMessageFromOther = lastMessage && 
        lastMessage.senderId.toString() === otherUserId;

      // Format last message preview with status indicator
      let lastMessagePreview = null;
      let lastMessageStatus = null;
      
      if (room.lastMessage) {
        // Determine message status indicator
        if (lastMessageFromOther && participant && participant.unreadCount > 0) {
          lastMessageStatus = "new"; // "➡️ New Byte" indicator
        } else if (!lastMessageFromOther && lastMessage) {
          // Last message is from current user, show status
          if (lastMessage.status === MessageStatus.SEEN) {
            lastMessageStatus = "seen"; // "✓ Seen" indicator
          } else if (lastMessage.status === MessageStatus.DELIVERED) {
            lastMessageStatus = "delivered"; // "▷ Delivered" indicator
          } else {
            lastMessageStatus = "sent"; // "Sent" indicator
          }
        }

        if (room.lastMessageType === MessageType.TEXT) {
          lastMessagePreview = room.lastMessage;
        } else if (room.lastMessageType === MessageType.IMAGE) {
          lastMessagePreview = "📷 Image";
        } else if (room.lastMessageType === MessageType.SNAP) {
          lastMessagePreview = "📸 Snap";
        } else if (room.lastMessageType === MessageType.POST) {
          lastMessagePreview = "📌 Post";
        } else if (room.lastMessageType === MessageType.WRITE_POST) {
          lastMessagePreview = "✍️ Write Post";
        } else if (room.lastMessageType === MessageType.ZEAL) {
          lastMessagePreview = "🎬 Zeal";
        } else {
          lastMessagePreview = room.lastMessage;
        }
      }

      return {
        id: roomId,
        roomId: roomId, // Also include as roomId for clarity
        chatType: room.chatType,
        otherUser: {
          id: otherUserId,
          name: otherUser.name,
          username: otherUser.username,
          profileImage: otherUser.profileImage,
          bio: otherUser.bio,
          isVerifiedBadge: otherUser.isVerifiedBadge,
          followersCount: followersCount, // Add followers count
        },
        lastMessage: lastMessagePreview,
        lastMessageType: room.lastMessageType,
        lastMessageStatus: lastMessageStatus, // Add status indicator
        lastMessageAt: room.lastMessageAt,
        timestamp: room.lastMessageAt ? formatChatListTime(room.lastMessageAt) : null, // 12-hour format "11:02 AM"
        timeAgo: room.lastMessageAt ? getTimeAgo(room.lastMessageAt) : null, // Keep for backward compatibility
        unreadCount: participant ? participant.unreadCount : 0,
        isBlocked: room.isBlocked,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      };
    });

    return {
      rooms: formattedRooms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error in getChatRooms:", error);
    throw error;
  }
};

/**
 * Get a single chat room by ID
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID (to verify access)
 * @returns {Promise<Object|null>} Chat room or null
 */
export const getChatRoomById = async (roomId, userId) => {
  try {
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
    })
      .populate("userA", "name username profileImage bio isVerifiedBadge")
      .populate("userB", "name username profileImage bio isVerifiedBadge")
      .lean();

    if (!room) {
      return null;
    }

    const roomIdString = room._id.toString();
    const otherUser = room.userA._id.toString() === userId ? room.userB : room.userA;
    const otherUserId = otherUser._id.toString();
    
    // Get followers count
    const followersCount = await UserFollower.countDocuments({ userId: otherUserId });
    
    const participant = await ChatParticipant.findOne({
      roomId: roomIdString,
      userId,
    }).lean();
    
    return {
      id: roomIdString,
      roomId: roomIdString, // Also include as roomId for clarity
      chatType: room.chatType,
      otherUser: {
        id: otherUserId,
        name: otherUser.name,
        username: otherUser.username,
        profileImage: otherUser.profileImage,
        bio: otherUser.bio,
        isVerifiedBadge: otherUser.isVerifiedBadge,
        followersCount: followersCount, // Add followers count
      },
      lastMessage: room.lastMessage,
      lastMessageType: room.lastMessageType,
      lastMessageAt: room.lastMessageAt,
      timestamp: room.lastMessageAt ? formatChatListTime(room.lastMessageAt) : null,
      unreadCount: participant ? participant.unreadCount : 0,
      isBlocked: room.isBlocked,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  } catch (error) {
    logger.error("Error in getChatRoomById:", error);
    throw error;
  }
};

/**
 * Delete a chat room (soft delete by blocking)
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID (to verify ownership)
 * @returns {Promise<boolean>} Success status
 */
export const deleteChatRoom = async (roomId, userId) => {
  try {
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
    });

    if (!room) {
      throw new Error("Chat room not found");
    }

    // Mark as blocked (soft delete)
    room.isBlocked = true;
    await room.save();

    logger.info(`Chat room ${roomId} blocked by user ${userId}`);
    return true;
  } catch (error) {
    logger.error("Error in deleteChatRoom:", error);
    throw error;
  }
};

export default {
  getOrCreateChatRoom,
  getChatRooms,
  getChatRoomById,
  deleteChatRoom,
};
