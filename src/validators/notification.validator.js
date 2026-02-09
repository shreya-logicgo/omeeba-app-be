import Joi from "joi";
import { createSchema } from "../utils/validation.js";
import { NotificationType, ContentType } from "../models/enums.js";

/**
 * Get Notifications validation schema
 */
export const getNotificationsSchema = createSchema(
  {
    status: Joi.string()
      .valid("all", "unread", "read")
      .optional()
      .messages({
        "any.only": "status must be one of: all, unread, read",
      }),
    type: Joi.string()
      .valid(...Object.values(NotificationType))
      .optional()
      .messages({
        "any.only": `type must be one of: ${Object.values(NotificationType).join(", ")}`,
      }),
    page: Joi.number().integer().min(1).optional().messages({
      "number.base": "page must be a number",
      "number.integer": "page must be an integer",
      "number.min": "page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).optional().messages({
      "number.base": "limit must be a number",
      "number.integer": "limit must be an integer",
      "number.min": "limit must be at least 1",
      "number.max": "limit cannot exceed 100",
    }),
  },
  ["status", "type", "page", "limit"]
);

/**
 * Notification ID validation schema
 */
export const notificationIdSchema = Joi.object({
  notificationId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "must be a valid notification ID",
      "any.required": "Notification ID is required",
    }),
});

/**
 * Create and Send Notification validation schema
 */
export const createAndSendNotificationSchema = Joi.object({
  receiverId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "receiverId must be a valid ObjectId",
    }),
  type: Joi.string()
    .valid(...Object.values(NotificationType))
    .required()
    .messages({
      "any.only": `type must be one of: ${Object.values(NotificationType).join(", ")}`,
    }),
  contentType: Joi.string()
    .valid(...Object.values(ContentType))
    .optional()
    .messages({
      "any.only": `contentType must be one of: ${Object.values(ContentType).join(", ")}`,
    }),
  contentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "contentId must be a valid ObjectId",
    }),
  message: Joi.string().optional().trim().min(1).messages({
    "string.min": "message cannot be empty",
  }),
  title: Joi.string().optional().trim().min(1).messages({
    "string.min": "title cannot be empty",
  }),
  metadata: Joi.object().optional(),
  playerIds: Joi.array()
    .items(Joi.string().trim().min(1))
    .optional()
    .messages({
      "array.base": "playerIds must be an array",
    }),
  sendToAll: Joi.boolean().optional().messages({
    "boolean.base": "sendToAll must be a boolean",
  }),
})
  .custom((value, helpers) => {
    // At least one of receiverId, playerIds, or sendToAll must be provided
    const hasReceiverId = !!value.receiverId;
    const hasPlayerIds = Array.isArray(value.playerIds) && value.playerIds.length > 0;
    const hasSendToAll = value.sendToAll === true;

    if (!hasReceiverId && !hasPlayerIds && !hasSendToAll) {
      return helpers.error("any.custom", {
        message: "Either receiverId, playerIds, or sendToAll must be provided",
      });
    }
    return value;
  })
  .unknown(false);

export default {
  getNotificationsSchema,
  notificationIdSchema,
  createAndSendNotificationSchema,
};

