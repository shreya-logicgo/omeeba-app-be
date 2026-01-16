/**
 * User Validators
 * Joi validation schemas for User endpoints
 */

import Joi from "joi";
import { commonValidations, createSchema } from "../utils/validation.js";

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
};

