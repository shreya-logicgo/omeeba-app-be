import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Create Write Post validation schema
 */
export const createWritePostSchema = createSchema(
  {
    content: Joi.string().trim().min(1).max(10000).required().messages({
      "string.empty": "is required",
      "string.min": "must be at least 1 character long",
      "string.max": "cannot exceed 10000 characters",
      "any.required": "is required",
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
  },
  ["title", "content", "mentionedUserIds"]
);

export default {
  createWritePostSchema,
};
