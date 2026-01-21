import Joi from "joi";
import { ContentType } from "../models/enums.js";
import { createSchema } from "../utils/validation.js";

/**
 * Content type body validation schema for toggle like
 */
export const toggleLikeBodySchema = createSchema(
  {
    contentType: Joi.string()
      .valid(...Object.values(ContentType))
      .required()
      .messages({
        "any.only": `Content type must be one of: ${Object.values(ContentType).join(", ")}`,
        "any.required": "Content type is required",
      }),
    contentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "must be a valid content ID",
        "any.required": "Content ID is required",
      }),
  },
  ["contentType", "contentId"]
);

/**
 * Content type parameter validation schema (for status endpoint)
 */
export const contentTypeParamsSchema = Joi.object({
  contentType: Joi.string()
    .valid(...Object.values(ContentType))
    .required()
    .messages({
      "any.only": `Content type must be one of: ${Object.values(ContentType).join(", ")}`,
      "any.required": "Content type is required",
    }),
  contentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "must be a valid content ID",
      "any.required": "Content ID is required",
    }),
});

export default {
  toggleLikeBodySchema,
  contentTypeParamsSchema,
};

