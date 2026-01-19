import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Create Poll validation schema
 */
export const createPollSchema = createSchema(
  {
    caption: Joi.string().trim().max(500).required().messages({
      "string.base": "Caption must be a string",
      "string.max": "Caption must not exceed 500 characters",
      "any.required": "Caption is required",
    }),
    options: Joi.array()
      .items(
        Joi.string().trim().min(1).max(200).required().messages({
          "string.base": "Option must be a string",
          "string.min": "Option cannot be empty",
          "string.max": "Option must not exceed 200 characters",
          "any.required": "Option text is required",
        })
      )
      .min(2)
      .max(10)
      .required()
      .messages({
        "array.base": "Options must be an array",
        "array.min": "At least 2 options are required",
        "array.max": "Cannot have more than 10 options",
        "any.required": "Options are required",
      }),
    duration: Joi.date()
      .iso()
      .greater("now")
      .required()
      .messages({
        "date.base": "Duration must be a valid date",
        "date.greater": "Duration must be in the future",
        "any.required": "Duration is required",
      }),
  },
  ["caption", "options", "duration"]
);

/**
 * Vote Poll validation schema
 */
export const votePollSchema = createSchema(
  {
    optionId: Joi.string().trim().required().messages({
      "string.base": "Option ID must be a string",
      "any.required": "Option ID is required",
    }),
  },
  ["optionId"]
);

export default {
  createPollSchema,
  votePollSchema,
};

