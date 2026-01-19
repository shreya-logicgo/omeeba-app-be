import Joi from "joi";
import { createSchema, commonValidations } from "../utils/validation.js";

/**
 * Update Profile validation schema
 */
export const updateProfileSchema = createSchema(
  {
    name: Joi.string().trim().min(1).max(100).optional(),
    username: Joi.string()
      .trim()
      .min(3)
      .max(30)
      .pattern(/^[a-zA-Z0-9_]+$/)
      .message("Username can only contain letters, numbers, and underscores")
      .optional(),
    bio: Joi.string().trim().max(500).allow("").optional(),
    profileImage: Joi.string().uri().allow("", null).optional(),
    coverImage: Joi.string().uri().allow("", null).optional(),
  },
  ["name", "username", "bio", "profileImage", "coverImage"]
);

/**
 * Get User Profile validation schema (for params)
 */
export const getUserProfileParamsSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "must be a valid user ID",
    }),
});

/**
 * Search users validation schema (query)
 */
export const searchUsersQuerySchema = createSchema(
  {
    username: Joi.string()
      .min(1)
      .max(100)
      .optional()
      .allow("")
      .messages({
        "string.min": "Search term must be at least 1 character",
        "string.max": "Search term must be at most 100 characters",
      })
      .label("Username"),
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
    page: commonValidations.page,
    limit: commonValidations.limit,
  },
  ["username", "search", "page", "limit"]
);

export default {
  searchUsersQuerySchema,
  updateProfileSchema,
  getUserProfileParamsSchema,
};
