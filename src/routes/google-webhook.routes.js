import { Router } from "express";
import { 
  handleGoogleWebhook, 
  testGoogleWebhook, 
  webhookHealthCheck 
} from "../controllers/google-webhook.controller.js";
import { validateGoogleWebhook, googleWebhookRateLimit } from "../middleware/google-webhook-validation.js";
import { protect } from "../middleware/auth.js";

const router = Router();

/**
 * @route POST /api/v1/google/webhook
 * @desc Handle Google Play Developer Notifications
 * @access Public (with validation and rate limiting)
 */
router.post("/webhook", 
  googleWebhookRateLimit,
  validateGoogleWebhook, 
  handleGoogleWebhook
);

/**
 * @route GET /api/v1/google/webhook/test
 * @desc Test endpoint for Google Play webhooks
 * @access Public
 */
router.get("/webhook/test", testGoogleWebhook);

/**
 * @route GET /api/v1/google/webhook/health
 * @desc Health check for Google Play webhook service
 * @access Public
 */
router.get("/webhook/health", webhookHealthCheck);

export default router;
