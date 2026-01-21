/**
 * Chat Validators
 * Joi schemas for chat request validation
 */

import Joi from "joi";

/**
 * Create Chat Room Body Schema
 */
export const createChatRoomBodySchema = Joi.object({
  otherUserId: Joi.string().required(),
  chatType: Joi.string().valid("Direct", "Request").optional(),
});

/**
 * Get Chat Rooms Query Schema
 */
export const getChatRoomsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

/**
 * Room ID Params Schema
 */
export const roomIdParamsSchema = Joi.object({
  roomId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Room ID is invalid. Please check and try again",
      "any.required": "Room ID is required",
    }),
});

/**
 * Get Messages Query Schema
 */
export const getMessagesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

/**
 * Send Message Body Schema
 */
export const sendMessageBodySchema = Joi.object({
  messageType: Joi.string()
    .valid("Text", "Image", "Snap", "Post", "Write Post", "Zeal")
    .required(),
  message: Joi.string().max(5000).allow(null, "").optional(),
  mediaUrl: Joi.string().uri().allow(null, "").optional(),
  thumbnailUrl: Joi.string().uri().allow(null, "").optional(),
  contentId: Joi.string().allow(null, "").optional(),
  contentType: Joi.string()
    .valid("Post", "Write Post", "Zeal")
    .allow(null, "")
    .optional(),
}).or("message", "mediaUrl", "contentId"); // At least one must be present

/**
 * Mark Messages as Read Body Schema
 */
export const markMessagesAsReadBodySchema = Joi.object({
  lastReadMessageId: Joi.string().allow(null, "").optional(),
});

/**
 * Support Request Body Schema
 */
export const createSupportRequestBodySchema = Joi.object({
  subject: Joi.string().required().trim().max(200),
  description: Joi.string().required().trim().max(1000),
  priority: Joi.string()
    .valid("low", "medium", "high", "urgent")
    .optional(),
});

/**
 * Get Support Requests Query Schema
 */
export const getSupportRequestsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
