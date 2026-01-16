import express from "express";
import { protect } from "../middleware/auth.js";
import { validateBody } from "../utils/validation.js";
import {
  createSubscriptionSchema,
  verifyRazorpayPaymentSchema,
  verifyStripePaymentSchema,
} from "../validators/subscription.validator.js";
import {
  getPlans,
  createSubscriptionHandler,
  verifyRazorpayPaymentHandler,
  verifyStripePaymentHandler,
  getActiveSubscription,
  getPaymentHistory,
  razorpayWebhookHandler,
  stripeWebhookHandler,
} from "../controllers/subscription.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v1/subscriptions/plans
 * @desc    Get active subscription plans
 * @access  Public
 */
router.get("/plans", getPlans);

/**
 * @route   GET /api/v1/subscriptions/active
 * @desc    Get user's active subscription
 * @access  Private
 */
router.get("/active", protect, getActiveSubscription);

/**
 * @route   GET /api/v1/subscriptions/payment-history
 * @desc    Get user's payment history
 * @access  Private
 */
router.get("/payment-history", protect, getPaymentHistory);

/**
 * @route   POST /api/v1/subscriptions
 * @desc    Create subscription and payment order
 * @access  Private
 */
router.post(
  "/",
  protect,
  validateBody(createSubscriptionSchema),
  createSubscriptionHandler
);

/**
 * @route   POST /api/v1/subscriptions/verify-razorpay
 * @desc    Verify Razorpay payment
 * @access  Private
 */
router.post(
  "/verify-razorpay",
  protect,
  validateBody(verifyRazorpayPaymentSchema),
  verifyRazorpayPaymentHandler
);

/**
 * @route   POST /api/v1/subscriptions/verify-stripe
 * @desc    Verify Stripe payment
 * @access  Private
 */
router.post(
  "/verify-stripe",
  protect,
  validateBody(verifyStripePaymentSchema),
  verifyStripePaymentHandler
);

/**
 * @route   POST /api/v1/subscriptions/webhooks/razorpay
 * @desc    Razorpay webhook handler
 * @access  Public (webhook)
 * @note    Webhook endpoint - no authentication required
 */
router.post(
  "/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhookHandler
);

/**
 * @route   POST /api/v1/subscriptions/webhooks/stripe
 * @desc    Stripe webhook handler
 * @access  Public (webhook)
 * @note    Webhook endpoint - no authentication required
 */
router.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

export default router;
