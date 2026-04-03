import crypto from 'crypto';
import { 
  verifyGooglePurchaseToken, 
  getUserByGoogleSubscription 
} from '../services/purchase-verification.service.js';
import UserSubscription from '../models/subscriptions/UserSubscription.js';
import SubscriptionPayment from '../models/subscriptions/SubscriptionPayment.js';
import { SubscriptionStatus } from '../models/enums.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { StatusCodes } from 'http-status-codes';
import logger from '../utils/logger.js';
import config from '../config/env.js';

/**
 * Handle Google Play Developer Notification
 * This endpoint receives real-time notifications from Google Play about subscription events
 */
export const handleGoogleWebhook = async (req, res) => {
  try {
    const { 
      version, 
      packageName, 
      eventTimeMillis, 
      subscriptionNotification, 
      testNotification 
    } = req.body;

    // Log incoming webhook
    logger.info('Google Play webhook received:', {
      version,
      packageName,
      eventTimeMillis,
      hasSubscriptionNotification: !!subscriptionNotification,
      hasTestNotification: !!testNotification
    });

    // Handle test notifications
    if (testNotification) {
      logger.info('Google Play test notification received');
      return sendSuccess(
        res,
        { received: true, test: true },
        "Test notification received successfully",
        StatusCodes.OK
      );
    }

    // Validate required fields for subscription notifications
    if (!subscriptionNotification) {
      logger.error('Google webhook missing subscription notification data');
      return sendError(
        res,
        "Missing subscription notification data",
        "Invalid Webhook",
        null,
        StatusCodes.BAD_REQUEST
      );
    }

    const {
      version: notificationVersion,
      notificationType,
      purchaseToken,
      subscriptionId
    } = subscriptionNotification;

    logger.info(`Processing Google Play notification: ${notificationType}`, {
      subscriptionId,
      purchaseToken: purchaseToken?.substring(0, 20) + '...'
    });

    // Process the notification based on type
    await processGoogleNotification(subscriptionNotification);

    // Return success response to Google Play
    return sendSuccess(
      res,
      { received: true },
      "Notification processed successfully",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error handling Google Play webhook:", error);
    
    // Still return 200 to Google to avoid retry spam, but log the error
    return sendSuccess(
      res,
      { received: true, error: "Internal processing error" },
      "Notification received but processing failed",
      StatusCodes.OK
    );
  }
};

/**
 * Process Google Play subscription notification
 */
const processGoogleNotification = async (notification) => {
  const { notificationType, purchaseToken, subscriptionId } = notification;

  try {
    switch (notificationType) {
      case 'SUBSCRIPTION_RECOVERED':
        await handleSubscriptionRecovered(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_RENEWED':
        await handleSubscriptionRenewed(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_CANCELED':
        await handleSubscriptionCanceled(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_PURCHASED':
        await handleSubscriptionPurchased(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_ON_HOLD':
        await handleSubscriptionOnHold(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_IN_GRACE_PERIOD':
        await handleSubscriptionGracePeriod(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_RESTARTED':
        await handleSubscriptionRestarted(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_EXPIRED':
        await handleSubscriptionExpired(purchaseToken, subscriptionId);
        break;
      
      case 'SUBSCRIPTION_REVOKED':
        await handleSubscriptionRevoked(purchaseToken, subscriptionId);
        break;
      
      default:
        logger.warn(`Unhandled Google Play notification type: ${notificationType}`);
    }

    logger.info(`Successfully processed Google notification: ${notificationType}`);
  } catch (error) {
    logger.error(`Error processing Google notification ${notificationType}:`, error);
    throw error;
  }
};

/**
 * Handle subscription purchased
 */
const handleSubscriptionPurchased = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling new subscription purchase: ${subscriptionId}`);
  
  // Find user by subscription
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription: ${subscriptionId}`);
    return;
  }

  // Verify purchase with Google Play
  const verificationResult = await verifyGooglePurchaseToken(purchaseToken, subscriptionId);
  if (!verificationResult.verified) {
    logger.error(`Purchase verification failed for subscription: ${subscriptionId}`);
    return;
  }

  // Update subscription status
  await updateSubscriptionFromGoogleVerification(user._id, verificationResult, 'SUBSCRIPTION_PURCHASED');
};

/**
 * Handle subscription renewed
 */
const handleSubscriptionRenewed = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription renewal: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription renewal: ${subscriptionId}`);
    return;
  }

  const verificationResult = await verifyGooglePurchaseToken(purchaseToken, subscriptionId);
  if (!verificationResult.verified) {
    logger.error(`Renewal verification failed for subscription: ${subscriptionId}`);
    return;
  }

  // Create renewal payment record
  await createRenewalPaymentRecord(user._id, verificationResult);
  
  // Update subscription
  await updateSubscriptionFromGoogleVerification(user._id, verificationResult, 'SUBSCRIPTION_RENEWED');
};

/**
 * Handle subscription canceled
 */
const handleSubscriptionCanceled = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription cancellation: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription cancellation: ${subscriptionId}`);
    return;
  }

  await UserSubscription.findOneAndUpdate(
    { 
      userId: user._id,
      productId: subscriptionId,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] }
    },
    {
      status: SubscriptionStatus.CANCELLED,
      cancellationReason: 'USER_CANCELED',
      autoRenewStatus: false,
      updatedAt: new Date()
    }
  );

  logger.info(`Subscription canceled for user: ${user._id}`);
};

/**
 * Handle subscription expired
 */
const handleSubscriptionExpired = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription expiration: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription expiration: ${subscriptionId}`);
    return;
  }

  await UserSubscription.findOneAndUpdate(
    { 
      userId: user._id,
      productId: subscriptionId,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED] }
    },
    {
      status: SubscriptionStatus.EXPIRED,
      expiresAt: new Date(),
      updatedAt: new Date()
    }
  );

  logger.info(`Subscription expired for user: ${user._id}`);
};

/**
 * Handle subscription revoked
 */
const handleSubscriptionRevoked = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription revocation: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription revocation: ${subscriptionId}`);
    return;
  }

  await UserSubscription.findOneAndUpdate(
    { 
      userId: user._id,
      productId: subscriptionId
    },
    {
      status: SubscriptionStatus.REVOKED,
      cancellationReason: 'REVOKED',
      expiresAt: new Date(),
      updatedAt: new Date()
    }
  );

  logger.info(`Subscription revoked for user: ${user._id}`);
};

/**
 * Handle subscription in grace period
 */
const handleSubscriptionGracePeriod = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription grace period: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription grace period: ${subscriptionId}`);
    return;
  }

  await UserSubscription.findOneAndUpdate(
    { 
      userId: user._id,
      productId: subscriptionId,
      status: SubscriptionStatus.ACTIVE
    },
    {
      status: SubscriptionStatus.GRACE_PERIOD,
      updatedAt: new Date()
    }
  );
};

/**
 * Handle subscription on hold
 */
const handleSubscriptionOnHold = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription on hold: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription on hold: ${subscriptionId}`);
    return;
  }

  await UserSubscription.findOneAndUpdate(
    { 
      userId: user._id,
      productId: subscriptionId,
      status: SubscriptionStatus.ACTIVE
    },
    {
      status: SubscriptionStatus.ON_HOLD,
      updatedAt: new Date()
    }
  );
};

/**
 * Handle subscription recovered
 */
const handleSubscriptionRecovered = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription recovery: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription recovery: ${subscriptionId}`);
    return;
  }

  const verificationResult = await verifyGooglePurchaseToken(purchaseToken, subscriptionId);
  if (!verificationResult.verified) {
    logger.error(`Recovery verification failed for subscription: ${subscriptionId}`);
    return;
  }

  await updateSubscriptionFromGoogleVerification(user._id, verificationResult, 'SUBSCRIPTION_RECOVERED');
};

/**
 * Handle subscription restarted
 */
const handleSubscriptionRestarted = async (purchaseToken, subscriptionId) => {
  logger.info(`Handling subscription restart: ${subscriptionId}`);
  
  const user = await getUserByGoogleSubscription(subscriptionId, purchaseToken);
  if (!user) {
    logger.warn(`No user found for subscription restart: ${subscriptionId}`);
    return;
  }

  const verificationResult = await verifyGooglePurchaseToken(purchaseToken, subscriptionId);
  if (!verificationResult.verified) {
    logger.error(`Restart verification failed for subscription: ${subscriptionId}`);
    return;
  }

  await updateSubscriptionFromGoogleVerification(user._id, verificationResult, 'SUBSCRIPTION_RESTARTED');
};

/**
 * Update subscription from Google verification result
 */
const updateSubscriptionFromGoogleVerification = async (userId, verificationResult, notificationType) => {
  const { subscriptionDetails } = verificationResult;
  
  const updateData = {
    status: SubscriptionStatus.ACTIVE,
    lastVerifiedAt: new Date(),
    updatedAt: new Date(),
    autoRenewStatus: subscriptionDetails.autoRenewing,
    environment: 'production'
  };

  // Calculate dates from Google response
  if (subscriptionDetails.startTimeMillis) {
    updateData.startDate = new Date(parseInt(subscriptionDetails.startTimeMillis));
  }
  
  if (subscriptionDetails.expirationTimeMillis) {
    updateData.expiresAt = new Date(parseInt(subscriptionDetails.expirationTimeMillis));
    updateData.endDate = new Date(parseInt(subscriptionDetails.expirationTimeMillis));
  }

  // Update or create subscription
  await UserSubscription.findOneAndUpdate(
    {
      userId,
      productId: subscriptionDetails.productId,
      originalTransactionId: subscriptionDetails.orderId
    },
    updateData,
    { upsert: true, new: true }
  );

  logger.info(`Subscription updated for user ${userId} via ${notificationType}`);
};

/**
 * Create renewal payment record
 */
const createRenewalPaymentRecord = async (userId, verificationResult) => {
  const { subscriptionDetails } = verificationResult;
  
  const payment = new SubscriptionPayment({
    userId,
    transactionId: subscriptionDetails.orderId,
    originalTransactionId: subscriptionDetails.orderId,
    productId: subscriptionDetails.productId,
    amount: subscriptionDetails.priceAmountMicros ? subscriptionDetails.priceAmountMicros / 1000000 : 0,
    currency: subscriptionDetails.priceCurrencyCode || 'USD',
    provider: 'google',
    status: 'completed',
    paymentType: 'renewal',
    purchaseToken: subscriptionDetails.purchaseToken,
    environment: 'production',
    verifiedAt: new Date()
  });

  await payment.save();
  logger.info(`Renewal payment record created for user: ${userId}`);
};

/**
 * Test endpoint for Google Play webhooks
 */
export const testGoogleWebhook = async (req, res) => {
  try {
    logger.info("Google Play webhook test endpoint called");
    
    return sendSuccess(
      res,
      { 
        message: "Google Play webhook endpoint is working",
        timestamp: new Date().toISOString(),
        method: req.method,
        userAgent: req.get('User-Agent')
      },
      "Webhook test successful",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error in Google Play webhook test:", error);
    return sendError(
      res,
      "Test failed",
      "Webhook Test Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Health check for Google Play webhook service
 */
export const webhookHealthCheck = async (req, res) => {
  try {
    return sendSuccess(
      res,
      {
        status: "healthy",
        service: "google-play-webhook",
        timestamp: new Date().toISOString(),
        version: "1.0.0"
      },
      "Google Play webhook service is healthy",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Error in Google Play webhook health check:", error);
    return sendError(
      res,
      "Health check failed",
      "Service Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
