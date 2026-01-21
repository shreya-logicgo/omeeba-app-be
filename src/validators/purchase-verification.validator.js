import Joi from "joi";
import { validateBody, validateQuery } from "../utils/validation.js";

/**
 * Validate Apple purchase verification request
 */
export const verifyApplePurchaseSchema = Joi.object({
  receiptData: Joi.string()
    .required()
    .messages({
      "string.empty": "is required",
      "any.required": "is required",
    }),
  productId: Joi.string()
    .optional()
    .allow("")
    .messages({
      "string.empty": "must be a valid string",
    }),
});

/**
 * Validate Google purchase verification request
 */
export const verifyGooglePurchaseSchema = Joi.object({
  packageName: Joi.string()
    .required()
    .messages({
      "string.empty": "is required",
      "any.required": "is required",
    }),
  productId: Joi.string()
    .required()
    .messages({
      "string.empty": "is required",
      "any.required": "is required",
    }),
  purchaseToken: Joi.string()
    .required()
    .messages({
      "string.empty": "is required",
      "any.required": "is required",
    }),
  orderId: Joi.string()
    .optional()
    .allow("")
    .messages({
      "string.empty": "must be a valid string",
    }),
});

/**
 * Validate restore purchases query parameters
 */
export const restorePurchasesQuerySchema = Joi.object({
  platform: Joi.string()
    .valid("apple", "google")
    .required()
    .messages({
      "any.only": "Platform must be either 'apple' or 'google'",
      "any.required": "Platform is required",
      "string.empty": "Platform is required",
    }),
});

/**
 * Middleware to validate Apple purchase verification request
 */
export const validateVerifyApplePurchase = validateBody(verifyApplePurchaseSchema);

/**
 * Middleware to validate Google purchase verification request
 */
export const validateVerifyGooglePurchase = validateBody(verifyGooglePurchaseSchema);

/**
 * Middleware to validate restore purchases query parameters
 */
export const validateRestorePurchases = validateQuery(restorePurchasesQuerySchema);
