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
import ChatParticipant from "../models/chat/ChatParticipant.js";
import { MessageStatus } from "../models/enums.js";
import { sendMessage } from "../services/chatMessage.service.js";
import { markMessagesAsRead } from "../services/chatRead.service.js";
import logger from "../utils/logger.js";

// Store active users: userId -> socketId
const activeUsers = new Map();
// Store socket rooms: socketId -> Set of roomIds
const socketRooms = new Map();

/**
 * Authenticate socket connection using JWT
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(" ")[1];

    if (!token) {
      return next(new Error("Authentication error: Token required"));
    }

    const decoded = jwt.verify(token, config.jwt.secretKey);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || user.isDeleted) {
      return next(new Error("Authentication error: User not found"));
    }

    // Attach user to socket
    socket.userId = user._id.toString();
    socket.user = user;

    next();
  } catch (error) {
    logger.error("Socket authentication error:", error);
    next(new Error("Authentication error: Invalid token"));
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
     */
    socket.on("send_message", async (data) => {
      try {
        const { roomId, messageType, message, mediaUrl, thumbnailUrl, contentId, contentType } = data;

        // Send message using service
        const formattedMessage = await sendMessage(roomId, userId, {
          messageType,
          message,
          mediaUrl,
          thumbnailUrl,
          contentId,
          contentType,
        });

        // Emit to all users in the room (including sender)
        io.to(`room:${roomId}`).emit("new_message", {
          message: formattedMessage,
        });

        // Update message status to DELIVERED for other users
        const room = await ChatRoom.findById(roomId);
        if (room) {
          const otherUserId = room.userA.toString() === userId ? room.userB : room.userA;
          
          // Check if other user is online
          const otherUserSocketId = activeUsers.get(otherUserId.toString());
          if (otherUserSocketId) {
            // Update message status to delivered
            await ChatMessage.findByIdAndUpdate(formattedMessage.id, {
              status: MessageStatus.DELIVERED,
            });

            // Emit delivered status
            io.to(`user:${otherUserId}`).emit("message_delivered", {
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
