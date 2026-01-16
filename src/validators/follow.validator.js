/**
 * Follow Validators
 * Joi validation schemas for Follow endpoints
 */

import Joi from "joi";
import { commonValidations, createSchema } from "../utils/validation.js";

/**
 * Follow/Unfollow User validation schema (params)
 */
export const followUserParamsSchema = createSchema(
  {
    userId: commonValidations.objectId.label("User ID"),
  },
  ["userId"]
);

/**
 * Get Follow Status validation schema (params)
 */
export const getFollowStatusParamsSchema = createSchema(
  {
    userId: commonValidations.objectId.label("User ID"),
  },
  ["userId"]
);

/**
 * Get Followers/Following validation schema (params + query)
 * userId can be ObjectId or "me" for current user
 */
export const getFollowersParamsSchema = createSchema(
  {
    userId: Joi.string()
      .custom((value, helpers) => {
        // Allow "me" or valid ObjectId
        if (value === "me") {
          return value;
        }
        // Validate ObjectId format
        if (/^[0-9a-fA-F]{24}$/.test(value)) {
          return value;
        }
        return helpers.error("any.invalid");
      })
      .messages({
        "any.invalid": "must be a valid ObjectId or 'me'",
      })
      .label("User ID"),
  },
  ["userId"]
);

export const getFollowersQuerySchema = createSchema(
  {
    userId: Joi.string()
      .custom((value, helpers) => {
        // Allow "me" or valid ObjectId
        if (value === "me") {
          return value;
        }
        // Validate ObjectId format
        if (/^[0-9a-fA-F]{24}$/.test(value)) {
          return value;
        }
        return helpers.error("any.invalid");
      })
      .optional()
      .messages({
        "any.invalid": "must be a valid ObjectId or 'me'",
      })
      .label("User ID"),
    page: commonValidations.page,
    limit: commonValidations.limit,
    search: Joi.string()
      .min(1)
      .max(100)
      .optional()
      .allow("")
      .messages({
        "string.min": "Search term must be at least 1 character",
        "string.max": "Search term must be at most 100 characters",
      })
      .label("Search"),
  },
  ["userId", "page", "limit", "search"]
);

export const getFollowCountsQuerySchema = createSchema(
  {
    userId: Joi.string()
      .custom((value, helpers) => {
        // Allow "me" or valid ObjectId
        if (value === "me") {
          return value;
        }
        // Validate ObjectId format
        if (/^[0-9a-fA-F]{24}$/.test(value)) {
          return value;
        }
        return helpers.error("any.invalid");
      })
      .optional()
      .messages({
        "any.invalid": "must be a valid ObjectId or 'me'",
      })
      .label("User ID"),
  },
  ["userId"]
);

export default {
  followUserParamsSchema,
  getFollowStatusParamsSchema,
  getFollowersParamsSchema,
  getFollowersQuerySchema,
  getFollowCountsQuerySchema,
};

