/**
 * Comment Like Validators
 * Joi schemas for comment like-related requests
 */

import Joi from "joi";
import { createSchema, commonValidations } from "../utils/validation.js";

/**
 * Schema for comment ID in params
 */
export const commentIdParamsSchema = Joi.object({
  commentId: commonValidations.objectId.label("Comment ID"),
});

export default {
  commentIdParamsSchema,
};
