/**
 * Comment Reply Validators
 * Joi schemas for comment reply-related requests
 */

import Joi from "joi";
import { createSchema, commonValidations } from "../utils/validation.js";

/**
 * Schema for creating a reply
 */
export const createReplyBodySchema = createSchema(
  {
    reply: Joi.string()
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
      .label("Reply"),
  },
  ["reply"]
);

/**
 * Schema for comment ID in params
 */
export const commentIdParamsSchema = Joi.object({
  commentId: commonValidations.objectId.label("Comment ID"),
});

/**
 * Schema for getting replies query
 */
export const getRepliesQuerySchema = createSchema(
  {
    page: commonValidations.page,
    limit: commonValidations.limit,
  },
  ["page", "limit"]
);

export default {
  createReplyBodySchema,
  commentIdParamsSchema,
  getRepliesQuerySchema,
};
