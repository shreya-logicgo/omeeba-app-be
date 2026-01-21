/**
 * Chat Routes
 * Routes for chat endpoints
 */

import express from "express";
import {
  getOrCreateChatRoomHandler,
  getChatRoomsHandler,
  getChatRoomByIdHandler,
  deleteChatRoomHandler,
} from "../controllers/chatRoom.controller.js";
import {
  sendMessageHandler,
  getMessagesHandler,
} from "../controllers/chatMessage.controller.js";
import {
  markMessagesAsReadHandler,
  getUnreadCountHandler,
  getTotalUnreadCountHandler,
} from "../controllers/chatRead.controller.js";
import { validateQuery, validateBody, validateParams } from "../utils/validation.js";
import {
  createChatRoomBodySchema,
  getChatRoomsQuerySchema,
  getMessagesQuerySchema,
  sendMessageBodySchema,
  markMessagesAsReadBodySchema,
  roomIdParamsSchema,
} from "../validators/chat.validator.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/chat/rooms/create
 * @desc    Get or create a chat room with another user
 * @access  Private
 */
router.post(
  "/rooms/create",
  protect,
  validateBody(createChatRoomBodySchema),
  getOrCreateChatRoomHandler
);

/**
 * @route   GET /api/v1/chat/rooms
 * @desc    Get chat rooms (inbox) for logged-in user
 * @access  Private
 */
router.get(
  "/rooms",
  protect,
  validateQuery(getChatRoomsQuerySchema),
  getChatRoomsHandler
);

/**
 * @route   GET /api/v1/chat/rooms/:roomId
 * @desc    Get a single chat room by ID
 * @access  Private
 */
router.get(
  "/rooms/:roomId",
  protect,
  validateParams(roomIdParamsSchema),
  getChatRoomByIdHandler
);

/**
 * @route   DELETE /api/v1/chat/rooms/:roomId
 * @desc    Delete (block) a chat room
 * @access  Private
 */
router.delete(
  "/rooms/:roomId",
  protect,
  validateParams(roomIdParamsSchema),
  deleteChatRoomHandler
);

/**
 * @route   GET /api/v1/chat/rooms/:roomId/messages
 * @desc    Get messages for a chat room with pagination
 * @access  Private
 */
router.get(
  "/rooms/:roomId/messages",
  protect,
  validateParams(roomIdParamsSchema),
  validateQuery(getMessagesQuerySchema),
  getMessagesHandler
);

/**
 * @route   POST /api/v1/chat/rooms/:roomId/messages
 * @desc    Send a message in a chat room
 * @access  Private
 */
router.post(
  "/rooms/:roomId/messages",
  protect,
  validateParams(roomIdParamsSchema),
  validateBody(sendMessageBodySchema),
  sendMessageHandler
);

/**
 * @route   POST /api/v1/chat/rooms/:roomId/read
 * @desc    Mark messages as read in a chat room
 * @access  Private
 */
router.post(
  "/rooms/:roomId/read",
  protect,
  validateParams(roomIdParamsSchema),
  validateBody(markMessagesAsReadBodySchema),
  markMessagesAsReadHandler
);

/**
 * @route   GET /api/v1/chat/rooms/:roomId/unread-count
 * @desc    Get unread count for a specific room
 * @access  Private
 */
router.get(
  "/rooms/:roomId/unread-count",
  protect,
  validateParams(roomIdParamsSchema),
  getUnreadCountHandler
);

/**
 * @route   GET /api/v1/chat/unread-count
 * @desc    Get total unread count across all rooms
 * @access  Private
 */
router.get("/unread-count", protect, getTotalUnreadCountHandler);

export default router;
