import Razorpay from "razorpay";
import Stripe from "stripe";
import config from "../config/env.js";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
  CURRENCY,
} from "../constants/index.js";
import logger from "../utils/logger.js";

// Initialize Razorpay
let razorpayInstance = null;
if (config.payment.razorpay.keyId && config.payment.razorpay.keySecret) {
  razorpayInstance = new Razorpay({
    key_id: config.payment.razorpay.keyId,
    key_secret: config.payment.razorpay.keySecret,
  });
}

// Initialize Stripe
let stripeInstance = null;
if (config.payment.stripe.secretKey) {
  stripeInstance = new Stripe(config.payment.stripe.secretKey);
}

/**
 * Create Razorpay Order
 * @param {number} amount - Amount in paise (INR smallest unit)
 * @param {string} currency - Currency code (default: INR)
 * @param {Object} options - Additional options (receipt, notes)
 * @returns {Promise<Object>} Razorpay order
 */
export const createRazorpayOrder = async (
  amount,
  currency = CURRENCY.INR,
  options = {}
) => {
  try {
    if (!razorpayInstance) {
      throw new Error("Razorpay is not configured");
    }

    const orderData = {
      amount: amount * 100, // Convert to paise
      currency: currency,
      receipt: options.receipt || `receipt_${Date.now()}`,
      notes: options.notes || {},
    };

    const order = await razorpayInstance.orders.create(orderData);

    logger.info(`Razorpay order created: ${order.id}`);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      status: order.status,
    };
  } catch (error) {
    logger.error("Error creating Razorpay order:", error);
    throw new Error(`Failed to create Razorpay order: ${error.message}`);
  }
};

/**
 * Verify Razorpay Payment
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @returns {Promise<Object>} Verified payment details
 */
export const verifyRazorpayPayment = async (orderId, paymentId, signature) => {
  try {
    if (!razorpayInstance) {
      throw new Error("Razorpay is not configured");
    }

    const crypto = await import("crypto");
    const generatedSignature = crypto
      .createHmac("sha256", config.payment.razorpay.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      throw new Error("Invalid payment signature");
    }

    // Fetch payment details from Razorpay
    const payment = await razorpayInstance.payments.fetch(paymentId);

    logger.info(`Razorpay payment verified: ${paymentId}`);

    return {
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount / 100, // Convert from paise to rupees
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      createdAt: new Date(payment.created_at * 1000),
    };
  } catch (error) {
    logger.error("Error verifying Razorpay payment:", error);
    throw new Error(`Failed to verify Razorpay payment: ${error.message}`);
  }
};

/**
 * Create Stripe Payment Intent
 * @param {number} amount - Amount in cents (USD smallest unit)
 * @param {string} currency - Currency code (default: USD)
 * @param {Object} options - Additional options (metadata, customer)
 * @returns {Promise<Object>} Stripe payment intent
 */
export const createStripePaymentIntent = async (
  amount,
  currency = CURRENCY.USD,
  options = {}
) => {
  try {
    if (!stripeInstance) {
      throw new Error("Stripe is not configured");
    }

    const paymentIntentData = {
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      metadata: options.metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    };

    if (options.customer) {
      paymentIntentData.customer = options.customer;
    }

    const paymentIntent =
      await stripeInstance.paymentIntents.create(paymentIntentData);

    logger.info(`Stripe payment intent created: ${paymentIntent.id}`);

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100, // Convert from cents to dollars
      currency: paymentIntent.currency.toUpperCase(),
      status: paymentIntent.status,
    };
  } catch (error) {
    logger.error("Error creating Stripe payment intent:", error);
    throw new Error(`Failed to create Stripe payment intent: ${error.message}`);
  }
};

/**
 * Verify Stripe Webhook
 * @param {string} payload - Raw request body
 * @param {string} signature - Stripe signature from header
 * @returns {Promise<Object>} Verified event
 */
export const verifyStripeWebhook = async (payload, signature) => {
  try {
    if (!stripeInstance) {
      throw new Error("Stripe is not configured");
    }

    if (!config.payment?.stripe?.webhookSecret) {
      throw new Error("Stripe webhook secret is not configured");
    }

    // Ensure payload is a Buffer
    const payloadBuffer = Buffer.isBuffer(payload)
      ? payload
      : Buffer.from(payload);

    logger.info(
      `Verifying Stripe webhook with secret length: ${config.payment.stripe.webhookSecret.length}`
    );

    const event = stripeInstance.webhooks.constructEvent(
      payloadBuffer,
      signature,
      config.payment.stripe.webhookSecret
    );

    logger.info(`Stripe webhook verified: ${event.type}`);

    return event;
  } catch (error) {
    logger.error("Error verifying Stripe webhook:", error);
    logger.error("Error type:", error.constructor.name);

    // Provide more specific error messages
    if (error.type === "StripeSignatureVerificationError") {
      logger.error("Stripe signature verification failed");
      logger.error("This could mean:");
      logger.error("- Webhook secret is incorrect");
      logger.error("- Request was not from Stripe");
      logger.error("- Request body was modified");
      throw new Error(
        `Webhook signature verification failed: ${error.message}`
      );
    }

    throw new Error(`Failed to verify Stripe webhook: ${error.message}`);
  }
};

/**
 * Get Payment Provider based on currency
 * @param {string} currency - Currency code
 * @returns {string} Payment provider
 */
export const getPaymentProvider = (currency) => {
  if (currency === CURRENCY.INR) {
    return PAYMENT_PROVIDERS.RAZORPAY;
  }
  return PAYMENT_PROVIDERS.STRIPE;
};

/**
 * Map Razorpay status to our payment status
 * @param {string} razorpayStatus - Razorpay payment status
 * @returns {string} Our payment status
 */
export const mapRazorpayStatus = (razorpayStatus) => {
  const statusMap = {
    created: PAYMENT_STATUS.PENDING,
    authorized: PAYMENT_STATUS.PENDING,
    captured: PAYMENT_STATUS.SUCCESS,
    refunded: PAYMENT_STATUS.REFUNDED,
    failed: PAYMENT_STATUS.FAILED,
  };
  return statusMap[razorpayStatus] || PAYMENT_STATUS.PENDING;
};

/**
 * Map Stripe status to our payment status
 * @param {string} stripeStatus - Stripe payment status
 * @returns {string} Our payment status
 */
export const mapStripeStatus = (stripeStatus) => {
  const statusMap = {
    requires_payment_method: PAYMENT_STATUS.PENDING,
    requires_confirmation: PAYMENT_STATUS.PENDING,
    requires_action: PAYMENT_STATUS.PENDING,
    processing: PAYMENT_STATUS.PENDING,
    requires_capture: PAYMENT_STATUS.PENDING,
    canceled: PAYMENT_STATUS.CANCELLED,
    succeeded: PAYMENT_STATUS.SUCCESS,
  };
  return statusMap[stripeStatus] || PAYMENT_STATUS.PENDING;
};

export default {
  createRazorpayOrder,
  verifyRazorpayPayment,
  createStripePaymentIntent,
  verifyStripeWebhook,
  getPaymentProvider,
  mapRazorpayStatus,
  mapStripeStatus,
};
