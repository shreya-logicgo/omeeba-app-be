/**
 * Socket.IO Server Setup
 * Handles real-time chat messaging, read receipts, and typing indicators
 */

import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import config from "../config/env.js";
import { User } from "../models/index.js";
import ChatRoom from "../models/chat/ChatRoom.js";
import ChatMessage from "../models/chat/ChatMessage.js";
import Snap from "../models/chat/Snap.js";
import { MessageStatus } from "../models/enums.js";
import { sendMessage, getMessages } from "../services/chatMessage.service.js";
import { markMessagesAsRead, getUnreadCount, getTotalUnreadCount } from "../services/chatRead.service.js";
import {
  getOrCreateChatRoom,
  getChatRooms,
  getChatRoomById,
  deleteChatRoom,
} from "../services/chatRoom.service.js";
import {
  sendSnapWithMediaId,
  getSnapsInbox,
  getSentSnaps,
  viewSnap,
} from "../services/snap.service.js";
import logger from "../utils/logger.js";

// Store active users: userId -> socketId
const activeUsers = new Map();
// Store socket rooms: socketId -> Set of roomIds
const socketRooms = new Map();

/**
 * Authenticate socket connection.
 * Supports:
 * 1. JWT token: auth.token or Authorization header
 * 2. userId: query ?userId=xxx or auth.userId (e.g. Postman WebSocket with Params)
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
    const userId = socket.handshake.query?.userId || socket.handshake.auth?.userId;

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secretKey);
      const user = await User.findById(decoded.id).select("-password");
      if (!user || user.isDeleted) {
        return next(new Error("Authentication error: User not found"));
      }
      socket.userId = user._id.toString();
      socket.user = user;
      return next();
    }

    if (userId) {
      const user = await User.findById(userId).select("-password");
      if (!user || user.isDeleted) {
        return next(new Error("Authentication error: User not found"));
      }
      socket.userId = user._id.toString();
      socket.user = user;
      return next();
    }

    return next(new Error("Authentication error: Token or userId required"));
  } catch (error) {
    logger.error("Socket authentication error:", error);
    next(new Error(error.message || "Authentication error: Invalid token"));
  }
};

/**
 * Initialize Socket.IO server
 */
export const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: config.cors.origins,
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const userId = socket.userId;
    const username = socket.user.username;

    logger.info(`Socket connected: User ${userId} (${username})`);

    // Store active user
    activeUsers.set(userId, socket.id);
    socketRooms.set(socket.id, new Set());

    // Join user's personal room for direct notifications
    socket.join(`user:${userId}`);

    // Get user's chat rooms and join them
    ChatRoom.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .then((rooms) => {
        rooms.forEach((room) => {
          const roomId = room._id.toString();
          socket.join(`room:${roomId}`);
          socketRooms.get(socket.id).add(roomId);
        });
      })
      .catch((error) => {
        logger.error("Error joining rooms:", error);
      });

    /**
     * Handle: Join a chat room
     */
    socket.on("join_room", async (data) => {
      try {
        const { roomId } = data;

        // Verify user has access to this room
        const room = await ChatRoom.findOne({
          _id: roomId,
          $or: [{ userA: userId }, { userB: userId }],
        });

        if (!room) {
          socket.emit("error", { message: "Room not found or access denied" });
          return;
        }

        socket.join(`room:${roomId}`);
        socketRooms.get(socket.id).add(roomId);

        logger.info(`User ${userId} joined room ${roomId}`);

        // Notify others in the room
        socket.to(`room:${roomId}`).emit("user_joined", {
          userId,
          username,
          roomId,
        });
      } catch (error) {
        logger.error("Join room error:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    /**
     * Handle: Leave a chat room
     */
    socket.on("leave_room", async (data) => {
      try {
        const { roomId } = data;
        socket.leave(`room:${roomId}`);
        socketRooms.get(socket.id)?.delete(roomId);

        logger.info(`User ${userId} left room ${roomId}`);

        socket.to(`room:${roomId}`).emit("user_left", {
          userId,
          username,
          roomId,
        });
      } catch (error) {
        logger.error("Leave room error:", error);
      }
    });

    /**
     * Handle: Send message
     * Use mediaId (from POST /media/upload) for photo/video; optional mediaUrl/thumbnailUrl otherwise.
     */
    socket.on("send_message", async (data) => {
      try {
        const { roomId, messageType, message, mediaId, mediaUrl, thumbnailUrl, contentId, contentType } = data;

        const formattedMessage = await sendMessage(roomId, userId, {
          messageType,
          message,
          mediaId,
          mediaUrl,
          thumbnailUrl,
          contentId,
          contentType,
        });

        // Emit to all users in the room (including sender)
        io.to(`room:${roomId}`).emit("new_message", {
          message: formattedMessage,
        });

        // Update message status to DELIVERED when recipient is online; tell SENDER (User A)
        const room = await ChatRoom.findById(roomId);
        if (room) {
          const otherUserId = room.userA.toString() === userId ? room.userB : room.userA;
          const otherUserSocketId = activeUsers.get(otherUserId.toString());

          if (otherUserSocketId) {
            await ChatMessage.findByIdAndUpdate(formattedMessage.id, {
              status: MessageStatus.DELIVERED,
            });
            // Emit to SENDER: "your message was delivered to recipient"
            io.to(`user:${userId}`).emit("message_delivered", {
              messageId: formattedMessage.id,
              roomId,
              status: MessageStatus.DELIVERED,
            });
          }
        }

        logger.info(`Message sent via socket in room ${roomId} by user ${userId}`);
      } catch (error) {
        logger.error("Send message error:", error);
        socket.emit("error", {
          message: error.message || "Failed to send message",
        });
      }
    });

    /**
     * Handle: Mark messages as read
     */
    socket.on("mark_read", async (data) => {
      try {
        const { roomId, lastReadMessageId } = data;

        const result = await markMessagesAsRead(roomId, userId, lastReadMessageId);

        // Notify other user in the room
        const room = await ChatRoom.findById(roomId);
        if (room) {
          const otherUserId = room.userA.toString() === userId ? room.userB : room.userA;
          
          io.to(`user:${otherUserId}`).emit("messages_read", {
            roomId,
            userId,
            lastReadMessageId: result.lastReadMessageId,
            lastReadAt: result.lastReadAt,
          });
        }

        logger.info(`Messages marked as read in room ${roomId} by user ${userId}`);
      } catch (error) {
        logger.error("Mark read error:", error);
        socket.emit("error", {
          message: error.message || "Failed to mark messages as read",
        });
      }
    });

    /**
     * Handle: Typing indicator
     */
    socket.on("typing_start", async (data) => {
      try {
        const { roomId } = data;

        // Verify user has access
        const room = await ChatRoom.findOne({
          _id: roomId,
          $or: [{ userA: userId }, { userB: userId }],
        });

        if (!room) {
          return;
        }

        // Notify others in the room
        socket.to(`room:${roomId}`).emit("user_typing", {
          userId,
          username,
          roomId,
          isTyping: true,
        });
      } catch (error) {
        logger.error("Typing start error:", error);
      }
    });

    socket.on("typing_stop", async (data) => {
      try {
        const { roomId } = data;

        socket.to(`room:${roomId}`).emit("user_typing", {
          userId,
          username,
          roomId,
          isTyping: false,
        });
      } catch (error) {
        logger.error("Typing stop error:", error);
      }
    });

    /**
     * Handle: Create or get room (ack + listen: room_created)
     */
    socket.on("create_room", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { otherUserId, chatType = "Direct" } = data || {};
        if (!otherUserId) {
          const res = { success: false, error: "otherUserId required" };
          cb(res);
          socket.emit("room_created", res);
          return;
        }
        const room = await getOrCreateChatRoom(userId, otherUserId, chatType);
        const res = { success: true, data: room };
        cb(res);
        socket.emit("room_created", res);
      } catch (e) {
        logger.error("create_room error:", e);
        const res = { success: false, error: e.message || "Failed to create room" };
        cb(res);
        socket.emit("room_created", res);
      }
    });

    /**
     * Handle: Get chat rooms / inbox (ack + listen: rooms_list)
     */
    socket.on("get_rooms", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { page = 1, limit = 20 } = data || {};
        const result = await getChatRooms(userId, page, limit);
        const res = { success: true, data: result };
        cb(res);
        socket.emit("rooms_list", res);
      } catch (e) {
        logger.error("get_rooms error:", e);
        const res = { success: false, error: e.message || "Failed to get rooms" };
        cb(res);
        socket.emit("rooms_list", res);
      }
    });

    /**
     * Handle: Get single room (ack + listen: room_detail)
     */
    socket.on("get_room", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { roomId } = data || {};
        if (!roomId) {
          const res = { success: false, error: "roomId required" };
          cb(res);
          socket.emit("room_detail", res);
          return;
        }
        const room = await getChatRoomById(roomId, userId);
        if (!room) {
          const res = { success: false, error: "Room not found" };
          cb(res);
          socket.emit("room_detail", res);
          return;
        }
        const res = { success: true, data: room };
        cb(res);
        socket.emit("room_detail", res);
      } catch (e) {
        logger.error("get_room error:", e);
        const res = { success: false, error: e.message || "Failed to get room" };
        cb(res);
        socket.emit("room_detail", res);
      }
    });

    /**
     * Handle: Get messages (ack + listen: messages_list)
     */
    socket.on("get_messages", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { roomId, page = 1, limit = 50 } = data || {};
        if (!roomId) {
          const res = { success: false, error: "roomId required" };
          cb(res);
          socket.emit("messages_list", res);
          return;
        }
        const result = await getMessages(roomId, userId, page, limit);
        const res = { success: true, data: result };
        cb(res);
        socket.emit("messages_list", res);
      } catch (e) {
        logger.error("get_messages error:", e);
        const res = { success: false, error: e.message || "Failed to get messages" };
        cb(res);
        socket.emit("messages_list", res);
      }
    });

    /**
     * Handle: Unread count (ack + listen: unread_count). roomId optional: total if omitted.
     */
    socket.on("get_unread_count", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { roomId } = data || {};
        const count = roomId
          ? await getUnreadCount(roomId, userId)
          : await getTotalUnreadCount(userId);
        const res = { success: true, data: { unreadCount: count, roomId: roomId || null } };
        cb(res);
        socket.emit("unread_count", res);
      } catch (e) {
        logger.error("get_unread_count error:", e);
        const res = { success: false, error: e.message || "Failed to get unread count" };
        cb(res);
        socket.emit("unread_count", res);
      }
    });

    /**
     * Handle: Delete room (ack + listen: room_deleted)
     */
    socket.on("delete_room", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { roomId } = data || {};
        if (!roomId) {
          const res = { success: false, error: "roomId required" };
          cb(res);
          socket.emit("room_deleted", res);
          return;
        }
        await deleteChatRoom(roomId, userId);
        const res = { success: true, data: { roomId } };
        cb(res);
        socket.emit("room_deleted", res);
      } catch (e) {
        logger.error("delete_room error:", e);
        const res = { success: false, error: e.message || "Failed to delete room" };
        cb(res);
        socket.emit("room_deleted", res);
      }
    });

    /**
     * Handle: Send snap (mediaId from POST /media/upload). Emit snap_sent to sender, new_snap to recipients.
     */
    socket.on("send_snap", async (data) => {
      try {
        const { mediaId, recipientIds, expiresInSeconds, duration } = data || {};
        const snap = await sendSnapWithMediaId(userId, {
          mediaId,
          recipientIds,
          expiresInSeconds,
          duration,
        });

        socket.emit("snap_sent", { snap });

        const fullSnap = await Snap.findById(snap.id)
          .populate("senderId", "name username profileImage isVerifiedBadge")
          .populate("recipients.userId", "name username profileImage isVerifiedBadge");
        if (fullSnap) {
          fullSnap.recipients.forEach((r) => {
            const rid = r.userId._id.toString();
            io.to(`user:${rid}`).emit("new_snap", {
              snap: {
                id: fullSnap._id.toString(),
                sender: {
                  id: fullSnap.senderId._id.toString(),
                  name: fullSnap.senderId.name,
                  username: fullSnap.senderId.username,
                  profileImage: fullSnap.senderId.profileImage,
                  isVerifiedBadge: fullSnap.senderId.isVerifiedBadge,
                },
                mediaType: fullSnap.mediaType,
                thumbnailUrl: fullSnap.thumbnailUrl,
                duration: fullSnap.duration,
                expiresAt: fullSnap.expiresAt,
                isExpired: fullSnap.isExpired,
                createdAt: fullSnap.createdAt,
              },
            });
          });
        }
        logger.info(`Snap sent via socket: ${snap.id} by user ${userId}`);
      } catch (e) {
        logger.error("send_snap error:", e);
        socket.emit("error", { message: e.message || "Failed to send snap" });
      }
    });

    /**
     * Handle: Snaps inbox (ack + listen: snaps_inbox)
     */
    socket.on("get_snaps_inbox", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { page = 1, limit = 20, includeExpired = false } = data || {};
        const result = await getSnapsInbox(userId, { page, limit, includeExpired });
        const res = { success: true, data: result };
        cb(res);
        socket.emit("snaps_inbox", res);
      } catch (e) {
        logger.error("get_snaps_inbox error:", e);
        const res = { success: false, error: e.message || "Failed to get snaps inbox" };
        cb(res);
        socket.emit("snaps_inbox", res);
      }
    });

    /**
     * Handle: Sent snaps (ack + listen: snaps_sent)
     */
    socket.on("get_snaps_sent", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { page = 1, limit = 20 } = data || {};
        const result = await getSentSnaps(userId, { page, limit });
        const res = { success: true, data: result };
        cb(res);
        socket.emit("snaps_sent", res);
      } catch (e) {
        logger.error("get_snaps_sent error:", e);
        const res = { success: false, error: e.message || "Failed to get sent snaps" };
        cb(res);
        socket.emit("snaps_sent", res);
      }
    });

    /**
     * Handle: View snap (ack + listen: snap_viewed). Returns viewUrl etc.
     */
    socket.on("view_snap", async (data, ack) => {
      const cb = typeof ack === "function" ? ack : () => {};
      try {
        const { snapId } = data || {};
        if (!snapId) {
          const res = { success: false, error: "snapId required" };
          cb(res);
          socket.emit("snap_viewed", res);
          return;
        }
        const result = await viewSnap(snapId, userId);
        const res = { success: true, data: result };
        cb(res);
        socket.emit("snap_viewed", res);
      } catch (e) {
        logger.error("view_snap error:", e);
        const res = { success: false, error: e.message || "Failed to view snap" };
        cb(res);
        socket.emit("snap_viewed", res);
      }
    });

    /**
     * Handle: Disconnect
     */
    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: User ${userId} (${username})`);

      // Remove from active users
      activeUsers.delete(userId);
      
      // Clean up socket rooms
      const rooms = socketRooms.get(socket.id);
      if (rooms) {
        rooms.forEach((roomId) => {
          socket.to(`room:${roomId}`).emit("user_left", {
            userId,
            username,
            roomId,
          });
        });
        socketRooms.delete(socket.id);
      }
    });
  });

  return io;
};

export default {
  initializeSocket,
};
