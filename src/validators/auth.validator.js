/**
 * Auth Validators
 * Joi validation schemas for authentication endpoints
 */

import Joi from "joi";
import { commonValidations, createSchema } from "../utils/validation.js";

/**
 * Registration validation schema
 */
export const registerSchema = createSchema(
  {
    email: commonValidations.email,
    phoneNumber: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        "number.base": "must be a valid phone number",
        "number.positive": "must be a positive number",
        "any.required": "is required",
      })
      .label("Phone Number"),
    countryCode: Joi.string()
      .required()
      .pattern(/^\+[1-9]\d{1,3}$/)
      .messages({
        "string.pattern.base": "must be a valid country code (e.g., +91, +1)",
        "any.required": "is required",
      }),
    name: commonValidations.stringRequired(2, 100),
    username: Joi.string()
      .alphanum()
      .min(3)
      .max(30)
      .required()
      .lowercase()
      .messages({
        "string.alphanum": "must contain only letters and numbers",
        "string.min": "must be at least 3 characters",
        "string.max": "must be at most 30 characters",
        "any.required": "is required",
      }),
    password: commonValidations.password,
  },
  ["email", "phoneNumber", "countryCode", "name", "username", "password"]
);

/**
 * Verify OTP validation schema
 * Supports both account verification and forgot password OTP
 */
export const verifyOTPSchema = createSchema(
  {
    email: commonValidations.email,
    otp: Joi.number().integer().positive().required().messages({
      "number.base": "must be a valid OTP",
      "number.positive": "must be a positive number",
      "any.required": "is required",
    }),
    type: Joi.string().valid("account", "password").optional().messages({
      "any.only": "must be either 'account' or 'password'",
    }),
  },
  ["email", "otp", "type"]
);

/**
 * Resend OTP validation schema
 */
export const resendOTPSchema = createSchema(
  {
    email: commonValidations.email,
  },
  ["email"]
);

/**
 * Login validation schema
 */
export const loginSchema = createSchema(
  {
    email: commonValidations.email,
    password: commonValidations.password,
  },
  ["email", "password"]
);

/**
 * Forgot Password validation schema
 */
export const forgotPasswordSchema = createSchema(
  {
    email: commonValidations.email,
  },
  ["email"]
);

/**
 * Reset Password validation schema
 * Only requires newPassword (OTP is verified in verify-otp API)
 */
export const resetPasswordSchema = createSchema(
  {
    email: commonValidations.email,
    newPassword: commonValidations.password,
  },
  ["email", "newPassword"]
);

export default {
  registerSchema,
  verifyOTPSchema,
  resendOTPSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
