import Joi from "joi";
import { sendValidationError } from "./response.js";
import { StatusCodes } from "http-status-codes";

/**
 * Validate request body against Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
export const validateBody = (schema, options = {}) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true, // Remove unknown fields
      ...options,
    });

    if (error) {
      const errorMessage = formatJoiError(error);
      return sendValidationError(res, errorMessage, StatusCodes.BAD_REQUEST);
    }

    // Replace req.body with validated and sanitized value
    req.body = value;
    next();
  };
};

/**
 * Validate request query parameters against Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
export const validateQuery = (schema, options = {}) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      ...options,
    });

    if (error) {
      const errorMessage = formatJoiError(error);
      return sendValidationError(res, errorMessage, StatusCodes.BAD_REQUEST);
    }

    req.query = value;
    next();
  };
};

/**
 * Validate request parameters against Joi schema
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
export const validateParams = (schema, options = {}) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true,
      ...options,
    });

    if (error) {
      const errorMessage = formatJoiError(error);
      return sendValidationError(res, errorMessage, StatusCodes.BAD_REQUEST);
    }

    req.params = value;
    next();
  };
};

/**
 * Format Joi validation errors into a clear message
 * @param {Object} error - Joi validation error
 * @returns {string} Formatted error message
 */
export const formatJoiError = (error) => {
  if (!error || !error.details) {
    return "Validation error";
  }

  const errors = error.details.map((detail) => {
    const field = detail.path.join(".");
    let message = detail.message.replace(/"/g, "").trim();

    // Capitalize field name
    const fieldCapitalized = field.charAt(0).toUpperCase() + field.slice(1);

    // Check if message already starts with the field name (case-insensitive)
    const fieldLower = field.toLowerCase();
    const messageLower = message.toLowerCase();

    if (
      messageLower.startsWith(fieldLower + " ") ||
      messageLower.startsWith(fieldLower + " is") ||
      messageLower.startsWith(fieldLower + " must")
    ) {
      // Message already contains field name, just capitalize first letter
      return message.charAt(0).toUpperCase() + message.slice(1);
    }

    // Message doesn't contain field name, prepend it
    return `${fieldCapitalized} ${message}`;
  });

  // Return first error message (most important)
  return errors[0] || "Validation error";
};

/**
 * Get all Joi validation errors as array
 * @param {Object} error - Joi validation error
 * @returns {Array} Array of error messages
 */
export const getAllJoiErrors = (error) => {
  if (!error || !error.details) {
    return ["Validation error"];
  }

  return error.details.map((detail) => {
    const field = detail.path.join(".");
    const message = detail.message.replace(/"/g, "");
    return `${field.charAt(0).toUpperCase() + field.slice(1)} ${message}`;
  });
};

/**
 * Create Joi schema with common validations
 * @param {Object} fields - Field definitions
 * @param {Array} allowedFields - Fields allowed in the request
 * @returns {Joi.Schema} Joi schema
 */
export const createSchema = (fields, allowedFields = null) => {
  let schema = Joi.object(fields);

  // If allowedFields is specified, only allow those fields
  if (allowedFields && Array.isArray(allowedFields)) {
    schema = schema.unknown(false); // Reject unknown fields
    // Validate that only allowed fields are present
    schema = schema.keys(
      Object.keys(fields).reduce((acc, key) => {
        if (allowedFields.includes(key)) {
          acc[key] = fields[key];
        }
        return acc;
      }, {})
    );
  } else {
    schema = schema.unknown(false); // Reject unknown fields by default
  }

  return schema;
};

/**
 * Common Joi validations
 */
export const commonValidations = {
  // ObjectId validation
  objectId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "must be a valid ObjectId",
      "any.required": "is required",
    }),

  // Optional ObjectId
  objectIdOptional: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null, "")
    .messages({
      "string.pattern.base": "must be a valid ObjectId",
    }),

  // Email validation
  email: Joi.string().email().required().messages({
    "string.email": "must be a valid email",
    "any.required": "is required",
  }),

  // Password validation
  password: Joi.string().min(6).required().messages({
    "string.min": "must be at least 6 characters",
    "any.required": "is required",
  }),

  // Pagination
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),

  // String validations
  stringRequired: (min = 1, max = 255) =>
    Joi.string()
      .min(min)
      .max(max)
      .required()
      .messages({
        "string.min": `must be at least ${min} characters`,
        "string.max": `must be at most ${max} characters`,
        "any.required": "is required",
      }),

  stringOptional: (min = 0, max = 255) =>
    Joi.string()
      .min(min)
      .max(max)
      .allow(null, "")
      .messages({
        "string.min": `must be at least ${min} characters`,
        "string.max": `must be at most ${max} characters`,
      }),

  // Number validations
  numberRequired: (min = null, max = null) => {
    let schema = Joi.number().required();
    if (min !== null) schema = schema.min(min);
    if (max !== null) schema = schema.max(max);
    return schema;
  },

  numberOptional: (min = null, max = null) => {
    let schema = Joi.number().allow(null);
    if (min !== null) schema = schema.min(min);
    if (max !== null) schema = schema.max(max);
    return schema;
  },

  // Boolean
  boolean: Joi.boolean().default(false),
  booleanRequired: Joi.boolean().required(),

  // Array
  arrayRequired: (itemSchema) => Joi.array().items(itemSchema).required(),
  arrayOptional: (itemSchema) => Joi.array().items(itemSchema).min(0).optional().default([]),

  // Date
  date: Joi.date().iso(),
  dateRequired: Joi.date().iso().required(),
};
