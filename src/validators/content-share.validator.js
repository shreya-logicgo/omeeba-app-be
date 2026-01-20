import Joi from "joi";
import { ContentType } from "../models/enums.js";
import { createSchema } from "../utils/validation.js";

/**
 * Share content body validation schema
 */
export const shareContentBodySchema = createSchema(
  {
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
    receiverIds: Joi.array()
      .items(
        Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .messages({
            "string.pattern.base": "must be a valid user ID",
          })
      )
      .min(1)
      .max(50) // Limit to 50 receivers per share
      .required()
      .messages({
        "array.base": "Receiver IDs must be an array",
        "array.min": "At least one receiver is required",
        "array.max": "Cannot share with more than 50 users at once",
        "any.required": "Receiver IDs are required",
      }),
  },
  ["contentType", "contentId", "receiverIds"]
);

/**
 * Content type body validation schema for count endpoint
 */
export const getShareCountBodySchema = createSchema(
  {
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
  },
  ["contentType", "contentId"]
);

export default {
  shareContentBodySchema,
  getShareCountBodySchema,
};

