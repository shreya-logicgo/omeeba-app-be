import Joi from "joi";
import { createSchema } from "../utils/validation.js";
import { NotificationType } from "../models/enums.js";

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

export default {
  getNotificationsSchema,
  notificationIdSchema,
};

