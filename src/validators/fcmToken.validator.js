import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Register/Update FCM Token validation schema
 */
export const registerFCMTokenSchema = createSchema(
  {
    fcmToken: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        "string.empty": "FCM token is required",
        "any.required": "FCM token is required",
      }),
  },
  ["fcmToken"]
);

/**
 * Remove FCM Token validation schema
 * No body required - just removes the token
 */
export const removeFCMTokenSchema = createSchema(
  {},
  []
);

/**
 * Toggle Push Notification validation schema
 */
export const togglePushNotificationSchema = createSchema(
  {
    enabled: Joi.boolean()
      .required()
      .messages({
        "boolean.base": "enabled must be a boolean",
        "any.required": "enabled is required",
      }),
  },
  ["enabled"]
);

export default {
  registerFCMTokenSchema,
  removeFCMTokenSchema,
  togglePushNotificationSchema,
};

