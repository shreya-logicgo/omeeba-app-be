import Joi from "joi";
import { createSchema } from "../utils/validation.js";

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

export default {
  updateProfileSchema,
};
