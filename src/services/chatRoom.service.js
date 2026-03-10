/**
 * Chat Room Service
 * Business logic for chat room operations
 */

import mongoose from "mongoose";
import ChatRoom from "../models/chat/ChatRoom.js";
import ChatMessage from "../models/chat/ChatMessage.js";
import ChatParticipant from "../models/chat/ChatParticipant.js";
import BlockedMessageRequest from "../models/chat/BlockedMessageRequest.js";
import UserFollower from "../models/users/UserFollower.js";
import { User } from "../models/index.js";
import { ChatType, MessageType, MessageStatus } from "../models/enums.js";
import { getTimeAgo } from "../utils/timeAgo.js";
import { formatChatListTime } from "../utils/timeFormatter.js";
import { getPaginationMeta } from "../utils/pagination.js";
import logger from "../utils/logger.js";

/**
 * Get or create a chat room between two users.
 * If the other user does not follow the current user, creates a REQUEST room (message request).
 * @param {string} currentUserId - The user initiating the chat (logged-in user)
 * @param {string} otherUserId - The other user
 * @param {string} chatType - Chat type hint (DIRECT or REQUEST); overridden by follow check
 * @returns {Promise<Object>} Chat room
 */
export const getOrCreateChatRoom = async (currentUserId, otherUserId, chatType = ChatType.DIRECT) => {
  try {
    // Ensure consistent ordering (smaller ID first) for room lookup
    const [userA, userB] = [currentUserId, otherUserId].sort();

    // Does the other user follow the current user? (recipient follows sender → direct chat)
    const otherFollowsCurrent = await UserFollower.findOne({
      userId: currentUserId,
      followerId: otherUserId,
    });

    const isDirectAllowed = !!otherFollowsCurrent;

    // Try to find existing room
    let room = await ChatRoom.findOne({ userA, userB });

    if (!room) {
      if (!isDirectAllowed) {
        // Other does not follow current → check if current is blocked from sending requests
        const blocked = await BlockedMessageRequest.findOne({
          blockedByUserId: otherUserId,
          blockedUserId: currentUserId,
        });
        if (blocked) {
          throw new Error("You cannot send a message request to this user");
        }
      }

      const effectiveChatType = isDirectAllowed ? ChatType.DIRECT : ChatType.REQUEST;
      const requesterId = isDirectAllowed ? null : currentUserId;

      room = await ChatRoom.create({
        userA,
        userB,
        chatType: effectiveChatType,
        requesterId,
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
    const otherUser = room.userA._id.toString() === currentUserId ? room.userB : room.userA;
    const otherUserIdStr = otherUser._id.toString();

    // Get followers count
    const followersCount = await UserFollower.countDocuments({ userId: otherUserIdStr });

    return {
      id: roomId,
      roomId: roomId, // Also include as roomId for clarity
      chatType: room.chatType,
      requesterId: room.requesterId ? room.requesterId.toString() : null,
      otherUser: {
        id: otherUserIdStr,
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
 * @param {string} search - Optional; filter by other user's username
 * @returns {Promise<Object>} Chat rooms with pagination
 */
export const getChatRooms = async (userId, page = 1, limit = 20, search = "") => {
  try {
    const skip = (page - 1) * limit;

    const baseQuery = { chatType: ChatType.DIRECT };
    if (search && search.trim()) {
      const matchingUsers = await User.find({
        username: { $regex: search.trim(), $options: "i" },
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();
      const matchingIds = matchingUsers.map((u) => u._id);
      if (matchingIds.length === 0) {
        return { rooms: [], pagination: getPaginationMeta(0, page, limit) };
      }
      baseQuery.$or = [
        { userA: userId, userB: { $in: matchingIds } },
        { userB: userId, userA: { $in: matchingIds } },
      ];
    } else {
      baseQuery.$or = [{ userA: userId }, { userB: userId }];
    }

    // Find all DIRECT (inbox) rooms only; request rooms are in getMessageRequests
    const rooms = await ChatRoom.find(baseQuery)
      .populate("userA", "name username profileImage bio isVerifiedBadge")
      .populate("userB", "name username profileImage bio isVerifiedBadge")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const countQuery = { ...baseQuery, isBlocked: { $ne: true } };
    const total = await ChatRoom.countDocuments(countQuery);

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
      // lastMessageStatus: "new" = from other, unread (dot); "read" = messages read but snap not viewed; "delivered" = sent by me, delivered; "open" = sent by me, recipient saw
      let lastMessagePreview = null;
      let lastMessageStatus = null;
      const hasUnread = participant && participant.unreadCount > 0;
      const isLastMessageSnap = room.lastMessageType === MessageType.SNAP;
      const isSnapUnviewed = lastMessage && lastMessage.status !== MessageStatus.SEEN;

      if (room.lastMessage) {
        if (lastMessageFromOther) {
          // Check if last message is an unviewed snap - show "New Byte" regardless of unreadCount
          if (isLastMessageSnap && isSnapUnviewed) {
            lastMessagePreview = "New Byte"; // snap from other, not viewed yet
            lastMessageStatus = hasUnread ? "new" : "read"; // "read" = messages read but snap not viewed
          } else if (hasUnread) {
            // Non-snap messages with unread count
            lastMessageStatus = "new"; // orange dot = new msg, view karna baki
          }
          // If hasUnread is false and not an unviewed snap, lastMessageStatus stays null (messages read)
        } else if (!lastMessageFromOther && lastMessage) {
          // Message sent by current user
          if (lastMessage.status === MessageStatus.SEEN) {
            lastMessageStatus = "open"; // samne wale ne dekha
          } else if (lastMessage.status === MessageStatus.DELIVERED) {
            lastMessageStatus = "delivered"; // sent by me, delivered
          } else {
            lastMessageStatus = "sent"; // sent
          }
        }

        // Set default preview if not set yet
        if (!lastMessagePreview) {
          if (room.lastMessageType === MessageType.TEXT) {
            lastMessagePreview = room.lastMessage;
          } else if (room.lastMessageType === MessageType.IMAGE) {
            lastMessagePreview = "Image";
          } else if (room.lastMessageType === MessageType.SNAP) {
            lastMessagePreview = "Snap"; // Viewed snap or sent by me
          } else if (room.lastMessageType === MessageType.POST) {
            lastMessagePreview = "Post";
          } else if (room.lastMessageType === MessageType.WRITE_POST) {
            lastMessagePreview = "Write Post";
          } else if (room.lastMessageType === MessageType.ZEAL) {
            lastMessagePreview = "Zeal";
          } else {
            lastMessagePreview = room.lastMessage;
          }
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
        lastMessageStatus: lastMessageStatus,
        lastMessageFromMe: room.lastMessage ? !lastMessageFromOther : null,
        lastMessageId: lastMessage ? lastMessage._id.toString() : null,
        lastMessageMediaUrl: lastMessage?.mediaUrl || null,
        lastMessageThumbnailUrl: lastMessage?.thumbnailUrl || null,
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
      pagination: getPaginationMeta(total, page, limit),
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
      requesterId: room.requesterId ? room.requesterId.toString() : null,
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
 * Delete a chat room permanently (room + messages + participants)
 * User can create a fresh room with same person again after delete
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

    // Hard delete: remove messages, participants, then room
    await Promise.all([
      ChatMessage.deleteMany({ roomId }),
      ChatParticipant.deleteMany({ roomId }),
    ]);
    await ChatRoom.deleteOne({ _id: roomId });

    logger.info(`Chat room ${roomId} and its data deleted by user ${userId}`);
    return true;
  } catch (error) {
    logger.error("Error in deleteChatRoom:", error);
    throw error;
  }
};

/**
 * Get all message requests for the current user (where they are the recipient)
 * @param {string} userId - Current user ID (recipient of requests)
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @param {string} search - Optional; filter by requester's username
 * @returns {Promise<Object>} Request rooms with pagination
 */
export const getMessageRequests = async (userId, page = 1, limit = 20, search = "") => {
  try {
    const skip = (page - 1) * limit;

    const baseQuery = {
      chatType: ChatType.REQUEST,
      requesterId: { $ne: userId }, // Exclude requests sent by this user
      $or: [
        { userA: userId, requesterId: { $ne: "$userA" } }, // User A is recipient (not requester)
        { userB: userId, requesterId: { $ne: "$userB" } }  // User B is recipient (not requester)
      ]
    };
    if (search && search.trim()) {
      const matchingUsers = await User.find({
        username: { $regex: search.trim(), $options: "i" },
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();
      const matchingIds = matchingUsers.map((u) => u._id);
      if (matchingIds.length === 0) {
        return { requests: [], pagination: getPaginationMeta(0, page, limit) };
      }
      baseQuery.requesterId = { $in: matchingIds };
    }

    const rooms = await ChatRoom.find(baseQuery)
      .populate("userA", "name username profileImage bio isVerifiedBadge")
      .populate("userB", "name username profileImage bio isVerifiedBadge")
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ChatRoom.countDocuments(baseQuery);

    const roomIds = rooms.map((r) => r._id.toString());
    const participants = await ChatParticipant.find({
      roomId: { $in: roomIds },
      userId,
    }).lean();
    const participantMap = new Map(participants.map((p) => [p.roomId.toString(), p]));

    const lastMessages = await ChatMessage.aggregate([
      { $match: { roomId: { $in: rooms.map((r) => r._id) } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$roomId", lastMessage: { $first: "$$ROOT" } } },
    ]);
    const lastMessageMap = new Map(
      lastMessages.map((item) => [item._id.toString(), item.lastMessage])
    );

    // Get "other user" (the requester) for each room
    const otherUserIds = rooms.map((room) => {
      const otherUser = room.userA._id.toString() === userId ? room.userB : room.userA;
      return otherUser._id.toString();
    });

    const followersCounts =
      otherUserIds.length > 0
        ? await UserFollower.aggregate([
          { $match: { userId: { $in: otherUserIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
          { $group: { _id: "$userId", count: { $sum: 1 } } },
        ])
        : [];
    const followersMap = new Map(followersCounts.map((item) => [item._id.toString(), item.count]));

    const formattedRooms = rooms.map((room) => {
      const roomId = room._id.toString();
      const participant = participantMap.get(roomId);

      // In this view, "otherUser" is always the one who sent the request
      const otherUser = room.userA._id.toString() === userId ? room.userB : room.userA;
      if (!otherUser || !otherUser._id) return null;

      const otherUserIdStr = otherUser._id.toString();
      const followersCount = followersMap.get(otherUserIdStr) || 0;
      const lastMessage = lastMessageMap.get(roomId);
      const hasUnread = participant && participant.unreadCount > 0;

      // Same logic as getChatRooms: dot = new msg from requester, view karna baki; New Byte = snap unviewed
      let lastMessagePreview = null;
      let lastMessageStatus = null;
      const isLastMessageSnap = room.lastMessageType === MessageType.SNAP;
      const isSnapUnviewed = lastMessage && lastMessage.status !== MessageStatus.SEEN;
      
      if (room.lastMessage) {
        // Check if last message is an unviewed snap - show "New Byte" regardless of unreadCount
        if (isLastMessageSnap && isSnapUnviewed) {
          lastMessagePreview = "New Byte"; // snap from requester, not viewed yet
          lastMessageStatus = hasUnread ? "new" : "read"; // "read" = messages read but snap not viewed
        } else if (hasUnread) {
          // Non-snap messages with unread count
          lastMessageStatus = "new"; // dot = requester ne msg bheja, maine abhi dekha nahi
        }
        // If hasUnread is false and not an unviewed snap, lastMessageStatus stays null (messages read)
        
        if (!lastMessagePreview) {
          if (room.lastMessageType === MessageType.TEXT) {
            lastMessagePreview = room.lastMessage;
          } else if (room.lastMessageType === MessageType.IMAGE) {
            lastMessagePreview = "Image";
          } else if (room.lastMessageType === MessageType.SNAP) {
            lastMessagePreview = "Snap"; // Viewed snap
          } else if (room.lastMessageType === MessageType.POST) {
            lastMessagePreview = "Post";
          } else if (room.lastMessageType === MessageType.WRITE_POST) {
            lastMessagePreview = "Write Post";
          } else if (room.lastMessageType === MessageType.ZEAL) {
            lastMessagePreview = "Zeal";
          } else {
            lastMessagePreview = room.lastMessage;
          }
        }
      }

      return {
        id: roomId,
        roomId,
        chatType: ChatType.REQUEST,
        otherUser: {
          id: otherUserIdStr,
          name: otherUser.name,
          username: otherUser.username,
          profileImage: otherUser.profileImage,
          bio: otherUser.bio,
          isVerifiedBadge: otherUser.isVerifiedBadge,
          followersCount,
        },
        lastMessage: lastMessagePreview,
        lastMessageType: room.lastMessageType,
        lastMessageStatus,
        lastMessageFromMe: false,
        lastMessageId: lastMessage ? lastMessage._id.toString() : null,
        lastMessageMediaUrl: lastMessage?.mediaUrl || null,
        lastMessageThumbnailUrl: lastMessage?.thumbnailUrl || null,
        lastMessageAt: room.lastMessageAt,
        timestamp: room.lastMessageAt ? formatChatListTime(room.lastMessageAt) : null,
        timeAgo: room.lastMessageAt ? getTimeAgo(room.lastMessageAt) : null,
        unreadCount: participant ? participant.unreadCount : 0,
        isBlocked: room.isBlocked ?? false,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      };
    });

    return {
      requests: formattedRooms.filter(Boolean),
      pagination: getPaginationMeta(total, page, limit),
    };
  } catch (error) {
    logger.error("Error in getMessageRequests:", error);
    throw error;
  }
};

/**
 * Accept a message request (recipient accepts → room becomes direct chat)
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID (must be the recipient, not the requester)
 * @returns {Promise<Object>} Updated room
 */
export const acceptMessageRequest = async (roomId, userId) => {
  try {
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
      chatType: ChatType.REQUEST,
    })
      .populate("userA", "name username profileImage bio isVerifiedBadge")
      .populate("userB", "name username profileImage bio isVerifiedBadge");

    if (!room) {
      throw new Error("Chat room not found or not a pending request");
    }

    const requesterIdStr = room.requesterId && room.requesterId.toString();
    if (requesterIdStr === userId) {
      throw new Error("Only the recipient can accept the request");
    }

    room.chatType = ChatType.DIRECT;
    room.requesterId = null;
    await room.save();

    const otherUser = room.userA._id.toString() === userId ? room.userB : room.userA;
    const otherUserIdStr = otherUser._id.toString();
    const followersCount = await UserFollower.countDocuments({ userId: otherUserIdStr });

    return {
      id: room._id.toString(),
      roomId: room._id.toString(),
      chatType: ChatType.DIRECT,
      requesterId: null,
      otherUser: {
        id: otherUserIdStr,
        name: otherUser.name,
        username: otherUser.username,
        profileImage: otherUser.profileImage,
        bio: otherUser.bio,
        isVerifiedBadge: otherUser.isVerifiedBadge,
        followersCount,
      },
      isBlocked: room.isBlocked,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  } catch (error) {
    logger.error("Error in acceptMessageRequest:", error);
    throw error;
  }
};

/**
 * Reject (Delete) a message request: remove thread; sender is not notified and can send again later
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID (must be the recipient)
 * @returns {Promise<boolean>} Success
 */
export const rejectMessageRequest = async (roomId, userId) => {
  try {
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
      chatType: ChatType.REQUEST,
    });

    if (!room) {
      throw new Error("Chat room not found or not a pending request");
    }

    const requesterIdStr = room.requesterId && room.requesterId.toString();
    if (requesterIdStr === userId) {
      throw new Error("Only the recipient can reject the request");
    }

    await Promise.all([
      ChatMessage.deleteMany({ roomId: room._id }),
      ChatParticipant.deleteMany({ roomId: room._id }),
    ]);
    await ChatRoom.deleteOne({ _id: roomId });

    logger.info(`Message request ${roomId} rejected (deleted) by user ${userId}; sender can request again`);
    return true;
  } catch (error) {
    logger.error("Error in rejectMessageRequest:", error);
    throw error;
  }
};

/**
 * Block a message request: remove from list and prevent requester from sending again
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID (must be the recipient)
 * @returns {Promise<boolean>} Success
 */
export const blockMessageRequest = async (roomId, userId) => {
  try {
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
      chatType: ChatType.REQUEST,
    });

    if (!room) {
      throw new Error("Chat room not found or not a pending request");
    }

    const requesterIdStr = room.requesterId && room.requesterId.toString();
    if (requesterIdStr === userId) {
      throw new Error("Only the recipient can block the request");
    }

    await BlockedMessageRequest.findOneAndUpdate(
      { blockedByUserId: userId, blockedUserId: requesterIdStr },
      { blockedByUserId: userId, blockedUserId: requesterIdStr },
      { upsert: true }
    );

    await Promise.all([
      ChatMessage.deleteMany({ roomId: room._id }),
      ChatParticipant.deleteMany({ roomId: room._id }),
    ]);
    await ChatRoom.deleteOne({ _id: roomId });

    logger.info(`Message request ${roomId} blocked by user ${userId}; requester ${requesterIdStr} cannot send again`);
    return true;
  } catch (error) {
    logger.error("Error in blockMessageRequest:", error);
    throw error;
  }
};

export default {
  getOrCreateChatRoom,
  getChatRooms,
  getChatRoomById,
  deleteChatRoom,
  getMessageRequests,
  acceptMessageRequest,
  rejectMessageRequest,
  blockMessageRequest,
};