import Joi from "joi";
import { createSchema, commonValidations } from "../utils/validation.js";

/**
 * Get eligible users query validation schema
 */
export const getEligibleUsersQuerySchema = createSchema(
  {
    search: Joi.string()
      .trim()
      .max(100)
      .allow("")
      .optional()
      .messages({
        "string.max": "Search term must be at most 100 characters",
      }),
    type: Joi.string()
      .valid("all", "followers", "following", "searchable")
      .optional()
      .default("all")
      .messages({
        "any.only": "Type must be one of: all, followers, following, searchable",
      }),
    page: commonValidations.page,
    limit: commonValidations.limit,
  },
  ["search", "type", "page", "limit"]
);

export default {
  getEligibleUsersQuerySchema,
};

