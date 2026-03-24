import { Router } from "express";
import { handleAppleWebhook, testAppleWebhook, webhookHealthCheck } from "../controllers/apple-webhook.controller.js";
import { 
  triggerVerification, 
  getAppleSubscriptions, 
  getSubscriptionByTransactionId, 
  getSubscriptionStats,
  verifySpecificSubscription 
} from "../controllers/apple-subscription.controller.js";
import { validateWebhook } from "../middleware/webhook-validation.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

/**
 * @route POST /api/v1/apple/webhook
 * @desc Handle Apple App Store Server Notifications
 * @access Public (no validation)
 */
router.post("/webhook", handleAppleWebhook);

/**
 * @route GET /api/v1/apple/webhook/test
 * @desc Test endpoint for Apple webhooks
 * @access Public
 */
router.get("/webhook/test", testAppleWebhook);

/**
 * @route GET /api/v1/apple/webhook/health
 * @desc Health check for webhook service
 * @access Public
 */
router.get("/webhook/health", webhookHealthCheck);

/**
 * @route POST /api/v1/apple/subscriptions/verify
 * @desc Manually trigger Apple subscription verification
 * @access Admin only
 */
router.post("/subscriptions/verify", protect, triggerVerification);

/**
 * @route GET /api/v1/apple/subscriptions
 * @desc Get all Apple subscriptions
 * @access Admin only
 */
router.get("/subscriptions", protect, getAppleSubscriptions);

/**
 * @route GET /api/v1/apple/subscriptions/stats
 * @desc Get Apple subscription statistics
 * @access Admin only
 */
router.get("/subscriptions/stats", protect, getSubscriptionStats);

/**
 * @route GET /api/v1/apple/subscriptions/transaction/:transactionId
 * @desc Get subscription by transaction ID
 * @access Admin only
 */
router.get("/subscriptions/transaction/:transactionId", protect, getSubscriptionByTransactionId);

/**
 * @route POST /api/v1/apple/subscriptions/transaction/:transactionId/verify
 * @desc Force verify a specific subscription
 * @access Admin only
 */
router.post("/subscriptions/transaction/:transactionId/verify", protect, verifySpecificSubscription);

export default router;
