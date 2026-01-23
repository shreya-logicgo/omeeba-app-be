import Joi from "joi";
import { ContentType } from "../models/enums.js";
import { createSchema, validateBody } from "../utils/validation.js";

/**
 * Content type body validation schema for toggle/save/unsave
 */
export const saveContentBodySchema = createSchema(
  {
    contentType: Joi.string()
      .valid(...Object.values(ContentType))
      .required()
      .messages({
        "any.only": `is required and must be one of: ${Object.values(ContentType).join(", ")}`,
        "any.required": "is required",
      }),
    contentId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "must be a valid content ID",
        "any.required": "is required",
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
      "any.only": `must be one of: ${Object.values(ContentType).join(", ")}`,
      "any.required": "is required",
    }),
  contentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "must be a valid content ID",
      "any.required": "is required",
    }),
});

/**
 * Body validation schema for saved content listing
 */
export const savedContentListBodySchema = Joi.object({
  contentType: Joi.string()
    .valid("all", ...Object.values(ContentType))
    .optional()
    .default("all")
    .messages({
      "any.only": `must be one of: all, ${Object.values(ContentType).join(", ")}`,
    }),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

/**
 * Middleware to validate saved content listing body parameters
 */
export const validateSavedContentListBody = validateBody(
  savedContentListBodySchema
);

export default {
  saveContentBodySchema,
  contentTypeParamsSchema,
  savedContentListBodySchema,
  validateSavedContentListBody,
};

