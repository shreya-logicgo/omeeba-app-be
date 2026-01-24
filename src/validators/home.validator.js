import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Home feed validation schema
 */
export const getHomeFeedSchema = createSchema(
  {
    item: Joi.string()
      .valid("all", "post", "posts", "write", "writes", "zeal", "zeels", "zeals")
      .optional()
      .messages({
        "any.only": "item must be one of: all, post(s), write(s), zeal(s)",
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
  ["item", "page", "limit"]
);

export default {
  getHomeFeedSchema,
};
