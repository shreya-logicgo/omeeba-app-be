/**
 * Auth Validators
 * Joi validation schemas for authentication endpoints
 */

import Joi from "joi";
import { commonValidations, createSchema } from "../utils/validation.js";

const deviceFields = {
  deviceId: Joi.string().allow(null, "").optional(),
  deviceName: Joi.string().allow(null, "").optional(),
  platform: Joi.string().allow(null, "").optional(),
  browser: Joi.string().allow(null, "").optional(),
};

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
      .pattern(/^\+[1-9]\d{0,2}$/)
      .messages({
        "string.pattern.base": "must be a valid country code (e.g., +91, +1)",
        "any.required": "is required",
      }),
    name: commonValidations.stringRequired(2, 100),
    username: Joi.string()
      .trim()
      .lowercase()
      .min(3)
      .max(30)
      .pattern(/^[a-z0-9_]+$/, "valid characters")
      .pattern(/^(?!_)/, "start underscore")
      .pattern(/(?<!_)$/, "end underscore")
      .pattern(/^(?!.*__)/, "double underscore")
      .required()
      .messages({
        "string.pattern.name": "Username {#name} rule violated",
        "string.min": "Username must be at least 3 characters",
        "string.max": "Username must be at most 30 characters",
        "any.required": "Username is required"
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
    ...deviceFields,
  },
  ["email", "otp", "type", "deviceId", "deviceName", "platform", "browser"]
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
    ...deviceFields,
  },
  ["email", "password", "deviceId", "deviceName", "platform", "browser"]
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

/**
 * Change Password validation schema
 * Requires oldPassword and newPassword (for authenticated users)
 */
export const changePasswordSchema = createSchema(
  {
    oldPassword: commonValidations.password.label("Old Password"),
    newPassword: commonValidations.password.label("New Password"),
  },
  ["oldPassword", "newPassword"]
);

/**
 * Refresh Token validation schema
 */
export const refreshTokenSchema = createSchema(
  {
    refreshToken: Joi.string().required().messages({
      "string.empty": "Refresh token cannot be empty",
      "any.required": "Refresh token is required",
    }),
    ...deviceFields,
  },
  ["refreshToken", "deviceId", "deviceName", "platform", "browser"]
);

export default {
  registerSchema,
  verifyOTPSchema,
  resendOTPSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  refreshTokenSchema,
};
