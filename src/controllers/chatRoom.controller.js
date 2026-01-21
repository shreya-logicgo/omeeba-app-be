/**
 * Chat Room Controller
 * Handles chat room HTTP requests
 */

import {
  getChatRooms,
  getChatRoomById,
  deleteChatRoom,
  getOrCreateChatRoom,
} from "../services/chatRoom.service.js";
import { sendSuccess, sendError, sendNotFound, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Get or Create Chat Room
 * @route POST /api/v1/chat/rooms/create
 * @access Private
 */
export const getOrCreateChatRoomHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { otherUserId, chatType = "Direct" } = req.body;

    if (!otherUserId) {
      return sendBadRequest(res, "otherUserId is required");
    }

    if (userId === otherUserId) {
      return sendBadRequest(res, "Cannot create room with yourself");
    }

    const room = await getOrCreateChatRoom(userId, otherUserId, chatType);

    return sendSuccess(
      res,
      { room },
      "Chat room retrieved/created successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get or create chat room error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get or create chat room",
      "Get or Create Chat Room Error",
      error.message || "An error occurred while getting or creating chat room",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Chat Rooms (Inbox)
 * @route GET /api/v1/chat/rooms
 * @access Private
 */
export const getChatRoomsHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = await getChatRooms(userId, page, limit);

    return sendSuccess(
      res,
      result,
      "Chat rooms retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get chat rooms error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get chat rooms",
      "Get Chat Rooms Error",
      error.message || "An error occurred while retrieving chat rooms",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Chat Room by ID
 * @route GET /api/v1/chat/rooms/:roomId
 * @access Private
 */
export const getChatRoomByIdHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id.toString();

    const room = await getChatRoomById(roomId, userId);

    if (!room) {
      return sendNotFound(res, "Chat room not found");
    }

    return sendSuccess(
      res,
      { room },
      "Chat room retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get chat room by ID error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get chat room",
      "Get Chat Room Error",
      error.message || "An error occurred while retrieving chat room",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Delete Chat Room
 * @route DELETE /api/v1/chat/rooms/:roomId
 * @access Private
 */
export const deleteChatRoomHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id.toString();

    await deleteChatRoom(roomId, userId);

    return sendSuccess(
      res,
      null,
      "Chat room deleted successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Delete chat room error:", error);

    if (error.message === "Chat room not found") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to delete chat room",
      "Delete Chat Room Error",
      error.message || "An error occurred while deleting chat room",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getOrCreateChatRoomHandler,
  getChatRoomsHandler,
  getChatRoomByIdHandler,
  deleteChatRoomHandler,
};
