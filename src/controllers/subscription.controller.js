import {
  getActivePlans,
  createSubscription,
  getUserActiveSubscription,
  getUserPaymentHistory,
} from "../services/subscription.service.js";
import {
  verifyRazorpayPayment,
  verifyStripeWebhook,
} from "../services/payment.service.js";
import {
  processPaymentSuccess,
  processPaymentFailure,
} from "../services/subscription.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendPaginated,
} from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { PAYMENT_PROVIDERS } from "../constants/index.js";
import {
  mapRazorpayStatus,
  mapStripeStatus,
} from "../services/payment.service.js";

/**
 * Get Active Subscription Plans
 * @route GET /api/v1/subscriptions/plans
 * @access Public
 */
export const getPlans = async (req, res) => {
  try {
    const plans = await getActivePlans();

    return sendSuccess(
      res,
      {
        plans: plans.map((plan) => ({
          id: plan.id || plan._id?.toString() || null,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          perDayPrice: plan.perDayPrice,
          perMonthPrice: plan.perMonthPrice,
          durationInDays: plan.durationInDays,
          durationInMonths: plan.durationInMonths,
          isVerifiedBadge: plan.isVerifiedBadge,
          prioritySupport: plan.prioritySupport,
          adFreeExperience: plan.adFreeExperience,
          description: plan.description || null,
        })),
      },
      "Plans retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get plans error:", error);
    return sendError(
      res,
      "Failed to get plans",
      "Get Plans Error",
      error.message || "An error occurred while retrieving plans",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Create Subscription
 * @route POST /api/v1/subscriptions
 * @access Private
 */
export const createSubscriptionHandler = async (req, res) => {
  try {
    const userId = req.user._id;
    const { planId } = req.body;

    const result = await createSubscription(userId, planId);

    return sendSuccess(
      res,
      result,
      "Subscription created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create subscription error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to create subscription",
      "Create Subscription Error",
      error.message || "An error occurred while creating subscription",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Verify Razorpay Payment
 * @route POST /api/v1/subscriptions/verify-razorpay
 * @access Private
 */
export const verifyRazorpayPaymentHandler = async (req, res) => {
  try {
    const { subscriptionId, orderId, paymentId, signature } = req.body;

    // Verify payment with Razorpay
    const paymentDetails = await verifyRazorpayPayment(
      orderId,
      paymentId,
      signature
    );

    // Process payment success
    const result = await processPaymentSuccess(subscriptionId, {
      provider: PAYMENT_PROVIDERS.RAZORPAY,
      transactionId: paymentId,
      amount: paymentDetails.amount,
      currency: paymentDetails.currency,
      status: mapRazorpayStatus(paymentDetails.status),
    });

    return sendSuccess(
      res,
      {
        subscription: {
          id: result.subscription._id,
          status: result.subscription.status,
          startDate: result.subscription.startDate,
          endDate: result.subscription.endDate,
          isVerifiedBadge: result.subscription.planId?.isVerifiedBadge || false,
        },
        payment: {
          id: result.payment._id,
          transactionId: result.payment.transactionId,
          amount: result.payment.amount,
          currency: result.payment.currency,
          status: result.payment.status,
          provider: result.payment.paymentProvider,
        },
        user: {
          isVerifiedBadge: true, // Badge activated
        },
      },
      "Payment verified successfully and verified badge activated",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Verify Razorpay payment error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to verify payment",
      "Verify Payment Error",
      error.message || "An error occurred while verifying payment",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Verify Stripe Payment
 * @route POST /api/v1/subscriptions/verify-stripe
 * @access Private
 */
export const verifyStripePaymentHandler = async (req, res) => {
  try {
    const { subscriptionId, paymentIntentId } = req.body;

    // For Stripe, we'll verify via webhook, but this endpoint can be used for client confirmation
    // In production, always verify via webhook
    const stripe = (await import("stripe")).default;
    const config = (await import("../config/env.js")).default;
    const stripeInstance = new stripe(config.payment.stripe.secretKey);

    const paymentIntent =
      await stripeInstance.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      // Process payment success
      const result = await processPaymentSuccess(subscriptionId, {
        provider: PAYMENT_PROVIDERS.STRIPE,
        transactionId: paymentIntentId,
        amount: paymentIntent.amount / 100, // Convert from cents
        currency: paymentIntent.currency.toUpperCase(),
        status: mapStripeStatus(paymentIntent.status),
      });

      return sendSuccess(
        res,
        {
          subscription: {
            id: result.subscription._id,
            status: result.subscription.status,
            startDate: result.subscription.startDate,
            endDate: result.subscription.endDate,
            isVerifiedBadge:
              result.subscription.planId?.isVerifiedBadge || false,
          },
          payment: {
            id: result.payment._id,
            transactionId: result.payment.transactionId,
            amount: result.payment.amount,
            currency: result.payment.currency,
            status: result.payment.status,
            provider: result.payment.paymentProvider,
          },
          user: {
            isVerifiedBadge: true, // Badge activated
          },
        },
        "Payment verified successfully and verified badge activated",
        StatusCodes.OK
      );
    } else {
      throw new Error("Payment not completed");
    }
  } catch (error) {
    logger.error("Verify Stripe payment error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to verify payment",
      "Verify Payment Error",
      error.message || "An error occurred while verifying payment",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get User Active Subscription
 * @route GET /api/v1/subscriptions/active
 * @access Private
 */
export const getActiveSubscription = async (req, res) => {
  try {
    const userId = req.user._id;

    const subscription = await getUserActiveSubscription(userId);

    if (!subscription) {
      return sendSuccess(
        res,
        { subscription: null },
        "No active subscription found",
        StatusCodes.OK
      );
    }

    return sendSuccess(
      res,
      {
        subscription: {
          id: subscription._id,
          plan: {
            id: subscription.planId._id,
            name: subscription.planId.name,
            price: subscription.planId.price,
            currency: subscription.planId.currency,
            billingCycle: subscription.planId.billingCycle,
            isVerifiedBadge: subscription.planId.isVerifiedBadge,
          },
          status: subscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
      },
      "Active subscription retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get active subscription error:", error);
    return sendError(
      res,
      "Failed to get active subscription",
      "Get Subscription Error",
      error.message || "An error occurred while retrieving subscription",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get User Payment History
 * @route GET /api/v1/subscriptions/payment-history
 * @access Private
 */
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const result = await getUserPaymentHistory(userId, page, limit);

    const payments = result.payments.map((payment) => ({
      id: payment._id,
      transactionId: payment.transactionId,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      provider: payment.paymentProvider,
      subscription: payment.subscriptionId
        ? {
            id: payment.subscriptionId._id,
            plan: payment.subscriptionId.planId
              ? {
                  name: payment.subscriptionId.planId.name,
                  price: payment.subscriptionId.planId.price,
                  currency: payment.subscriptionId.planId.currency,
                  billingCycle: payment.subscriptionId.planId.billingCycle,
                }
              : null,
            startDate: payment.subscriptionId.startDate,
            endDate: payment.subscriptionId.endDate,
            status: payment.subscriptionId.status,
          }
        : null,
      createdAt: payment.createdAt,
    }));

    return sendPaginated(
      res,
      payments,
      result.pagination,
      "Payment history retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get payment history error:", error);
    return sendError(
      res,
      "Failed to get payment history",
      "Get Payment History Error",
      error.message || "An error occurred while retrieving payment history",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Razorpay Webhook Handler
 * @route POST /api/v1/subscriptions/webhooks/razorpay
 * @access Public (webhook)
 */
export const razorpayWebhookHandler = async (req, res) => {
  try {
    // Ensure body is Buffer (from express.raw middleware)
    if (!req.body || !Buffer.isBuffer(req.body)) {
      logger.warn("Razorpay webhook: Invalid body format, expected Buffer");
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Invalid request body format" });
    }

    const bodyString = req.body.toString("utf8");
    const event = JSON.parse(bodyString);

    logger.info(`Razorpay webhook received: ${event.event}`);

    // Verify webhook signature
    const crypto = await import("crypto");
    const config = (await import("../config/env.js")).default;

    if (!config.payment?.razorpay?.webhookSecret) {
      logger.error("Razorpay webhook secret not configured");
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: "Webhook configuration error" });
    }

    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      logger.warn("Razorpay webhook: Missing signature header");
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Missing signature" });
    }

    const generatedSignature = crypto
      .createHmac("sha256", config.payment.razorpay.webhookSecret)
      .update(bodyString)
      .digest("hex");

    if (generatedSignature !== signature) {
      logger.warn("Invalid Razorpay webhook signature");
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Invalid signature" });
    }

    // Handle different event types
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const subscriptionId = payment.notes?.subscriptionId;

      if (subscriptionId) {
        logger.info(
          `Processing Razorpay payment success for subscription: ${subscriptionId}`
        );
        await processPaymentSuccess(subscriptionId, {
          provider: PAYMENT_PROVIDERS.RAZORPAY,
          transactionId: payment.id,
          amount: payment.amount / 100, // Convert from paise
          currency: payment.currency,
          status: mapRazorpayStatus(payment.status),
        });
        logger.info(`Razorpay payment processed successfully: ${payment.id}`);
      } else {
        logger.warn(
          "Razorpay webhook: Missing subscriptionId in payment notes"
        );
      }
    } else if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      const subscriptionId = payment.notes?.subscriptionId;

      if (subscriptionId) {
        logger.info(
          `Processing Razorpay payment failure for subscription: ${subscriptionId}`
        );
        await processPaymentFailure(subscriptionId, {
          provider: PAYMENT_PROVIDERS.RAZORPAY,
          transactionId: payment.id,
          amount: payment.amount / 100,
          currency: payment.currency,
        });
        logger.info(`Razorpay payment failure processed: ${payment.id}`);
      } else {
        logger.warn(
          "Razorpay webhook: Missing subscriptionId in payment notes"
        );
      }
    } else {
      logger.info(`Razorpay webhook: Unhandled event type: ${event.event}`);
    }

    return res.status(StatusCodes.OK).json({ received: true });
  } catch (error) {
    logger.error("Razorpay webhook error:", error);
    logger.error("Razorpay webhook error stack:", error.stack);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Webhook processing failed" });
  }
};

/**
 * Stripe Webhook Handler
 * @route POST /api/v1/subscriptions/webhooks/stripe
 * @access Public (webhook)
 */
export const stripeWebhookHandler = async (req, res) => {
  try {
    // Ensure body is Buffer (from express.raw middleware)
    if (!req.body || !Buffer.isBuffer(req.body)) {
      logger.warn("Stripe webhook: Invalid body format, expected Buffer");
      logger.warn(
        `Stripe webhook: Body type: ${typeof req.body}, isBuffer: ${Buffer.isBuffer(req.body)}`
      );
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Invalid request body format" });
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      logger.warn("Stripe webhook: Missing signature header");
      logger.warn(
        `Stripe webhook: Available headers: ${JSON.stringify(Object.keys(req.headers))}`
      );
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .json({ error: "Missing signature" });
    }

    // Check webhook secret configuration
    const config = (await import("../config/env.js")).default;
    if (!config.payment?.stripe?.webhookSecret) {
      logger.error("Stripe webhook: Webhook secret not configured");
      logger.error(
        "Please set STRIPE_WEBHOOK_SECRET in your environment variables"
      );
      return res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: "Webhook configuration error" });
    }

    // req.body is raw buffer for Stripe webhooks
    const payload = req.body;

    logger.info(
      `Stripe webhook: Attempting to verify signature. Payload size: ${payload.length} bytes`
    );

    // Verify webhook
    const event = await verifyStripeWebhook(payload, signature);
    logger.info(`Stripe webhook received: ${event.type}`);

    // Handle different event types
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const subscriptionId = paymentIntent.metadata?.subscriptionId;

      if (subscriptionId) {
        logger.info(
          `Processing Stripe payment success for subscription: ${subscriptionId}`
        );
        await processPaymentSuccess(subscriptionId, {
          provider: PAYMENT_PROVIDERS.STRIPE,
          transactionId: paymentIntent.id,
          amount: paymentIntent.amount / 100, // Convert from cents
          currency: paymentIntent.currency.toUpperCase(),
          status: mapStripeStatus(paymentIntent.status),
        });
        logger.info(
          `Stripe payment processed successfully: ${paymentIntent.id}`
        );
      } else {
        logger.warn(
          "Stripe webhook: Missing subscriptionId in payment intent metadata"
        );
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const subscriptionId = paymentIntent.metadata?.subscriptionId;

      if (subscriptionId) {
        logger.info(
          `Processing Stripe payment failure for subscription: ${subscriptionId}`
        );
        await processPaymentFailure(subscriptionId, {
          provider: PAYMENT_PROVIDERS.STRIPE,
          transactionId: paymentIntent.id,
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency.toUpperCase(),
        });
        logger.info(`Stripe payment failure processed: ${paymentIntent.id}`);
      } else {
        logger.warn(
          "Stripe webhook: Missing subscriptionId in payment intent metadata"
        );
      }
    } else {
      logger.info(`Stripe webhook: Unhandled event type: ${event.type}`);
    }

    return res.status(StatusCodes.OK).json({ received: true });
  } catch (error) {
    logger.error("Stripe webhook error:", error);
    logger.error("Stripe webhook error message:", error.message);
    logger.error("Stripe webhook error stack:", error.stack);

    // If it's a signature verification error, return 401 with helpful message
    if (
      error.message &&
      (error.message.includes("signature") ||
        error.message.includes("No signatures found"))
    ) {
      logger.error("Stripe webhook signature verification failed");
      logger.error("This usually means:");
      logger.error("1. STRIPE_WEBHOOK_SECRET is incorrect");
      logger.error(
        "2. For ngrok/local development, use the webhook secret from Stripe CLI"
      );
      logger.error(
        "3. For production, use the webhook secret from Stripe Dashboard"
      );
      return res.status(StatusCodes.UNAUTHORIZED).json({
        error: "Invalid signature",
        message:
          "Webhook signature verification failed. Please check your STRIPE_WEBHOOK_SECRET configuration.",
      });
    }

    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: "Webhook processing failed" });
  }
};

export default {
  getPlans,
  createSubscriptionHandler,
  verifyRazorpayPaymentHandler,
  verifyStripePaymentHandler,
  getActiveSubscription,
  getPaymentHistory,
  razorpayWebhookHandler,
  stripeWebhookHandler,
};
