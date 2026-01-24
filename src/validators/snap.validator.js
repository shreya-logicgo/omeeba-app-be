/**
 * Snap Validators
 * Joi schemas for snap request validation
 */

import Joi from "joi";

/**
 * Create Snap Body Schema
 */
export const createSnapBodySchema = Joi.object({
  recipientIds: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(50)
    .required()
    .messages({
      "array.min": "At least one recipient is required",
      "array.max": "Maximum 50 recipients allowed",
      "any.required": "Recipients are required",
    }),
  mediaType: Joi.string().valid("image", "video").required().messages({
    "any.only": "Media type must be 'image' or 'video'",
    "any.required": "Media type is required",
  }),
  mimeType: Joi.string()
    .valid(
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo"
    )
    .required()
    .messages({
      "any.only": "Invalid MIME type",
      "any.required": "MIME type is required",
    }),
  duration: Joi.number().positive().optional().messages({
    "number.positive": "Duration must be a positive number",
  }),
  expiresInSeconds: Joi.number()
    .integer()
    .min(60) // Minimum 1 minute
    .max(604800) // Maximum 7 days
    .optional()
    .default(86400) // Default 24 hours
    .messages({
      "number.min": "Expiration time must be at least 60 seconds",
      "number.max": "Expiration time cannot exceed 7 days",
    }),
});

/**
 * Snap ID Params Schema
 */
export const snapIdParamsSchema = Joi.object({
  snapId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Snap ID is invalid. Please check and try again",
      "any.required": "Snap ID is required",
    }),
});

/**
 * Get Snaps Query Schema
 */
export const getSnapsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  includeExpired: Joi.boolean().optional().default(false),
});
