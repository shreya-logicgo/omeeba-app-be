import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Create Post validation schema
 */
export const createPostSchema = createSchema(
  {
    caption: Joi.string().trim().max(500).allow("").optional(),
    images: Joi.array()
      .items(
        Joi.string().uri().messages({
          "string.uri": "must be a valid image URL",
        })
      )
      .min(1)
      .max(20)
      .required()
      .messages({
        "array.base": "Images must be an array",
        "array.min": "At least one image is required",
        "array.max": "Cannot upload more than 10 images",
        "any.required": "At least one image is required",
      }),
    mentionedUserIds: Joi.array()
      .items(
        Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .messages({
            "string.pattern.base": "must be a valid user ID",
          })
      )
      .optional()
      .messages({
        "array.base": "Mentioned user IDs must be an array",
      }),
    musicId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow(null, "")
      .optional()
      .messages({
        "string.pattern.base": "must be a valid music ID",
      }),
    musicStartTime: Joi.number()
      .integer()
      .min(0)
      .allow(null)
      .optional()
      .messages({
        "number.base": "must be a number",
        "number.integer": "must be an integer",
        "number.min": "must be 0 or greater",
      }),
    musicEndTime: Joi.number()
      .integer()
      .min(0)
      .allow(null)
      .optional()
      .messages({
        "number.base": "must be a number",
        "number.integer": "must be an integer",
        "number.min": "must be 0 or greater",
      }),
  },
  [
    "caption",
    "images",
    "mentionedUserIds",
    "musicId",
    "musicStartTime",
    "musicEndTime",
  ]
);

export default {
  createPostSchema,
};
