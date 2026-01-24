import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Get Trending Content validation schema
 */
export const getTrendingSchema = createSchema(
  {
    contentType: Joi.string()
      .valid("all", "post", "write", "zeal")
      .optional()
      .messages({
        "any.only": "contentType must be one of: all, post, write, zeal",
      }),
    page: Joi.number().integer().min(1).optional().messages({
      "number.base": "page must be a number",
      "number.integer": "page must be an integer",
      "number.min": "page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).optional().messages({
      "number.base": "limit must be a number",
      "number.integer": "limit must be an integer",
      "number.min": "limit must be at least 1",
      "number.max": "limit cannot exceed 100",
    }),
  },
  ["contentType", "page", "limit"]
);

/**
 * Search validation schema
 */
export const searchSchema = createSchema(
  {
    query: Joi.string().trim().min(1).max(200).optional().allow("").messages({
      "string.base": "query must be a string",
      "string.min": "query must be at least 1 character",
      "string.max": "query cannot exceed 200 characters",
    }),
    type: Joi.string()
      .valid("explore", "trending", "polls", "users")
      .required()
      .messages({
        "any.only": "type must be one of: explore, trending, polls, users",
        "any.required": "type is required",
      }),
    contentType: Joi.string()
      .valid("zeal", "post")
      .optional()
      .messages({
        "any.only": "contentType must be one of: zeal, post (only for explore type)",
      }),
  },
  ["query", "type", "contentType"]
);

/**
 * Get Hashtag Content validation schema
 */
export const getHashtagContentSchema = createSchema(
  {
    contentType: Joi.string()
      .valid("all", "post", "write", "zeal", "poll")
      .optional()
      .messages({
        "any.only": "contentType must be one of: all, post, write, zeal, poll",
      }),
    sortBy: Joi.string()
      .valid("relevance", "popularity", "recent")
      .optional()
      .messages({
        "any.only": "sortBy must be one of: relevance, popularity, recent",
      }),
    page: Joi.number().integer().min(1).optional().messages({
      "number.base": "page must be a number",
      "number.integer": "page must be an integer",
      "number.min": "page must be at least 1",
    }),
    limit: Joi.number().integer().min(1).max(100).optional().messages({
      "number.base": "limit must be a number",
      "number.integer": "limit must be an integer",
      "number.min": "limit must be at least 1",
      "number.max": "limit cannot exceed 100",
    }),
  },
  ["contentType", "sortBy", "page", "limit"]
);

export default {
  getTrendingSchema,
  searchSchema,
  getHashtagContentSchema,
};

