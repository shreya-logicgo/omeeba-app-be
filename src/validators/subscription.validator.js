import Joi from "joi";
import { createSchema } from "../utils/validation.js";

/**
 * Create Subscription validation schema
 */
export const createSubscriptionSchema = createSchema(
  {
    planId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "must be a valid plan ID",
        "any.required": "is required",
      }),
  },
  ["planId"]
);

/**
 * Verify Payment validation schema (for Razorpay)
 */
export const verifyRazorpayPaymentSchema = createSchema(
  {
    subscriptionId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "must be a valid subscription ID",
        "any.required": "is required",
      }),
    orderId: Joi.string().required().messages({
      "any.required": "is required",
    }),
    paymentId: Joi.string().required().messages({
      "any.required": "is required",
    }),
    signature: Joi.string().required().messages({
      "any.required": "is required",
    }),
  },
  ["subscriptionId", "orderId", "paymentId", "signature"]
);

/**
 * Verify Payment validation schema (for Stripe)
 */
export const verifyStripePaymentSchema = createSchema(
  {
    subscriptionId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "must be a valid subscription ID",
        "any.required": "is required",
      }),
    paymentIntentId: Joi.string().required().messages({
      "any.required": "is required",
    }),
  },
  ["subscriptionId", "paymentIntentId"]
);

export default {
  createSubscriptionSchema,
  verifyRazorpayPaymentSchema,
  verifyStripePaymentSchema,
};
