/**
 * Comment Listing Validators
 * Joi schemas for comment listing requests
 */

import Joi from "joi";
import { createSchema, commonValidations } from "../utils/validation.js";
import { ContentType } from "../models/enums.js";

/**
 * Schema for getting comments query
 */
export const getCommentsQuerySchema = createSchema(
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
    page: commonValidations.page,
    limit: commonValidations.limit,
  },
  ["contentType", "contentId", "page", "limit"]
);

export default {
  getCommentsQuerySchema,
};
