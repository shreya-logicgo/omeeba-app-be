import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Register/Update OneSignal Player ID validation schema
 */
export const registerPlayerIdSchema = createSchema(
  {
    playerId: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        "string.empty": "Player ID cannot be empty",
        "any.required": "Player ID is required",
      }),
  },
  ["playerId"]
);

/**
 * Remove Player ID validation schema
 * No body required - just removes the player ID
 */
export const removePlayerIdSchema = createSchema(
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
  registerPlayerIdSchema,
  removePlayerIdSchema,
  togglePushNotificationSchema,
};

