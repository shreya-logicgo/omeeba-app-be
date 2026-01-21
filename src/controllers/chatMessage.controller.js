/**
 * Chat Message Controller
 * Handles chat message HTTP requests
 */

import { sendMessage, getMessages } from "../services/chatMessage.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Send Message
 * @route POST /api/v1/chat/rooms/:roomId/messages
 * @access Private
 */
export const sendMessageHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const senderId = req.user._id.toString();
    const messageData = req.body;

    const message = await sendMessage(roomId, senderId, messageData);

    return sendSuccess(
      res,
      { message },
      "Message sent successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Send message error:", error);

    if (error.message === "Chat room not found or access denied" || error.message === "Chat room is blocked") {
      return sendBadRequest(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to send message",
      "Send Message Error",
      error.message || "An error occurred while sending message",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Messages
 * @route GET /api/v1/chat/rooms/:roomId/messages
 * @access Private
 */
export const getMessagesHandler = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user._id.toString();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const result = await getMessages(roomId, userId, page, limit);

    return sendSuccess(
      res,
      result,
      "Messages retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get messages error:", error);

    if (error.message === "Chat room not found or access denied") {
      return sendBadRequest(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get messages",
      "Get Messages Error",
      error.message || "An error occurred while retrieving messages",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  sendMessageHandler,
  getMessagesHandler,
};
