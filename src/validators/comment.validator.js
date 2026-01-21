/**
 * Comment Validators
 * Joi schemas for comment-related requests
 */

import Joi from "joi";
import { createSchema, commonValidations } from "../utils/validation.js";
import { ContentType } from "../models/enums.js";

/**
 * Schema for creating a comment
 */
export const createCommentBodySchema = createSchema(
  {
    contentType: Joi.string()
      .valid(...Object.values(ContentType))
      .required()
      .messages({
        "any.only": `must be one of: ${Object.values(ContentType).join(", ")}`,
        "any.required": "is required",
      })
      .label("Content Type"),
    contentId: commonValidations.objectId.label("Content ID"),
    comment: Joi.string()
      .trim()
      .min(1)
      .max(1000)
      .required()
      .messages({
        "string.min": "must be at least 1 character",
        "string.max": "must be at most 1000 characters",
        "any.required": "is required",
        "string.empty": "cannot be empty",
      })
      .label("Comment"),
  },
  ["contentType", "contentId", "comment"]
);

export default {
  createCommentBodySchema,
};
