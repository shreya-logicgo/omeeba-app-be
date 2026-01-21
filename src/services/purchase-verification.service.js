import https from "https";
import { URL } from "url";
import SubscriptionPlan from "../models/subscriptions/SubscriptionPlan.js";
import SubscriptionPayment from "../models/subscriptions/SubscriptionPayment.js";
import UserSubscription from "../models/subscriptions/UserSubscription.js";
import User from "../models/users/User.js";
import { SubscriptionStatus, BillingCycle } from "../models/enums.js";
import { PAYMENT_PROVIDERS } from "../constants/index.js";
import logger from "../utils/logger.js";
import config from "../config/env.js";

/**
 * Verify Apple App Store receipt
 * @param {string} receiptData - Base64 encoded receipt data
 * @param {boolean} isProduction - Whether to use production or sandbox endpoint
 * @returns {Promise<Object>} Verified receipt data
 */
const verifyAppleReceipt = async (receiptData, isProduction = true) => {
  return new Promise((resolve, reject) => {
    const verifyUrl = isProduction
      ? "https://buy.itunes.apple.com/verifyReceipt"
      : "https://sandbox.itunes.apple.com/verifyReceipt";

    const appSecret = config.apple?.appSecret || process.env.APPLE_APP_SECRET; // Shared secret from App Store Connect

    const postData = JSON.stringify({
      "receipt-data": receiptData,
      password: appSecret, // Shared secret (optional, but recommended)
      "exclude-old-transactions": true,
    });

    const url = new URL(verifyUrl);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (response.status === 0) {
            resolve(response);
          } else if (response.status === 21007) {
            // Receipt is from sandbox but was sent to production
            // Retry with sandbox
            logger.info("Apple receipt from sandbox, retrying with sandbox endpoint");
            verifyAppleReceipt(receiptData, false)
              .then(resolve)
              .catch(reject);
          } else if (response.status === 21008) {
            // Receipt is from production but was sent to sandbox
            logger.info("Apple receipt from production, retrying with production endpoint");
            verifyAppleReceipt(receiptData, true)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error(`Apple verification failed with status: ${response.status}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse Apple verification response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(new Error(`Apple verification request failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
};

/**
 * Verify Google Play Store purchase token with Google API
 * @param {string} packageName - App package name
 * @param {string} productId - Product ID (SKU)
 * @param {string} purchaseToken - Purchase token from Google Play
 * @returns {Promise<Object>} Verified purchase data
 */
const verifyGooglePurchaseToken = async (packageName, productId, purchaseToken) => {
  try {
    // Google Play Developer API requires service account credentials
    // This is a simplified version - in production, use googleapis library
    const googleServiceAccount = config.google?.serviceAccountKey || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!googleServiceAccount) {
      throw new Error("Google service account key not configured");
    }

    // For now, we'll use the Google Play Developer API REST endpoint
    // In production, you should use the googleapis library with proper authentication
    const serviceAccount = JSON.parse(googleServiceAccount);
    
    // This is a placeholder - actual implementation requires OAuth2 JWT token
    // You would need to use googleapis library:
    // const { google } = require('googleapis');
    // const auth = new google.auth.GoogleAuth({
    //   credentials: serviceAccount,
    //   scopes: ['https://www.googleapis.com/auth/androidpublisher']
    // });
    // const androidpublisher = google.androidpublisher({ version: 'v3', auth });
    // const result = await androidpublisher.purchases.products.get({
    //   packageName,
    //   productId,
    //   token: purchaseToken
    // });

    // For now, return a mock structure that would come from the API
    // In production, implement the full Google Play API integration
    throw new Error("Google Play verification requires googleapis library. Please install it and implement proper OAuth2 authentication.");
  } catch (error) {
    logger.error("Google Play verification error:", error);
    throw error;
  }
};

/**
 * Calculate expiration date based on billing cycle
 * @param {string} billingCycle - Billing cycle (Monthly, Quarterly, Yearly)
 * @returns {Date} Expiration date
 */
const calculateExpirationDate = (billingCycle) => {
  const now = new Date();
  const expirationDate = new Date(now);

  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      expirationDate.setMonth(expirationDate.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      expirationDate.setMonth(expirationDate.getMonth() + 3);
      break;
    case BillingCycle.YEARLY:
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      break;
    default:
      expirationDate.setMonth(expirationDate.getMonth() + 1);
  }

  return expirationDate;
};

/**
 * Find or create subscription plan by product ID
 * @param {string} productId - Product ID from store
 * @param {string} platform - Platform (apple or google)
 * @returns {Promise<Object>} Subscription plan
 */
const findPlanByProductId = async (productId, platform) => {
  // Try to find plan by matching product ID patterns
  // You might need to store productId in SubscriptionPlan model or have a mapping
  // For now, we'll try to infer from product ID or use a default
  const plans = await SubscriptionPlan.find({ isActive: true }).sort({
    price: 1,
  });

  // If productId contains billing cycle hints, match them
  const billingCycleMap = {
    monthly: BillingCycle.MONTHLY,
    quarterly: BillingCycle.QUARTERLY,
    yearly: BillingCycle.YEARLY,
    month: BillingCycle.MONTHLY,
    quarter: BillingCycle.QUARTERLY,
    year: BillingCycle.YEARLY,
  };

  for (const [key, cycle] of Object.entries(billingCycleMap)) {
    if (productId.toLowerCase().includes(key)) {
      const plan = plans.find((p) => p.billingCycle === cycle && p.isVerifiedBadge);
      if (plan) return plan;
    }
  }

  // Default to first plan with verified badge
  const defaultPlan = plans.find((p) => p.isVerifiedBadge);
  if (!defaultPlan) {
    throw new Error("No active subscription plan with verified badge found");
  }

  return defaultPlan;
};

/**
 * Grant verified badge to user
 * @param {string} userId - User ID
 * @param {Date} expirationDate - Badge expiration date
 */
const grantVerifiedBadge = async (userId, expirationDate) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found");
  }

  user.isVerifiedBadge = true;
  // Store expiration date (you might want to add this field to User model)
  // For now, we'll rely on UserSubscription.endDate
  await user.save();

  logger.info(`Verified badge granted to user ${userId}, expires: ${expirationDate}`);
};

/**
 * Revoke verified badge from user
 * @param {string} userId - User ID
 */
const revokeVerifiedBadge = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    return;
  }

  user.isVerifiedBadge = false;
  await user.save();

  logger.info(`Verified badge revoked from user ${userId}`);
};

/**
 * Verify and process Apple App Store purchase
 * @param {string} userId - User ID
 * @param {string} receiptData - Base64 encoded receipt data
 * @param {string} productId - Product ID (optional, extracted from receipt if not provided)
 * @returns {Promise<Object>} Verification result
 */
export const verifyApplePurchase = async (userId, receiptData, productId = null) => {
  try {
    // Verify receipt with Apple
    const verificationResult = await verifyAppleReceipt(receiptData);

    if (!verificationResult.receipt || !verificationResult.receipt.in_app) {
      throw new Error("Invalid receipt data from Apple");
    }

    // Get the latest transaction
    const latestTransaction = verificationResult.receipt.in_app
      .sort((a, b) => parseInt(b.purchase_date_ms) - parseInt(a.purchase_date_ms))[0];

    if (!latestTransaction) {
      throw new Error("No transactions found in receipt");
    }

    const transactionId = latestTransaction.transaction_id;
    const actualProductId = productId || latestTransaction.product_id;

    // Check for duplicate transaction
    const existingPayment = await SubscriptionPayment.findOne({
      transactionId: transactionId,
      paymentProvider: PAYMENT_PROVIDERS.APPLE,
    });

    if (existingPayment) {
      // Transaction already processed - return existing subscription info
      const subscription = await UserSubscription.findById(
        existingPayment.subscriptionId
      ).populate("planId");

      return {
        verified: true,
        alreadyProcessed: true,
        subscription: {
          status: subscription.status,
          endDate: subscription.endDate,
          plan: subscription.planId,
        },
      };
    }

    // Find or create subscription plan
    const plan = await findPlanByProductId(actualProductId, "apple");

    // Calculate expiration date
    const expirationDate = calculateExpirationDate(plan.billingCycle);

    // Create user subscription
    const subscription = new UserSubscription({
      userId,
      planId: plan._id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: expirationDate,
    });

    await subscription.save();

    // Create payment record
    const payment = new SubscriptionPayment({
      userId,
      subscriptionId: subscription._id,
      amount: plan.price,
      currency: plan.currency,
      paymentProvider: PAYMENT_PROVIDERS.APPLE,
      transactionId: transactionId,
      status: SubscriptionStatus.ACTIVE,
      receiptData: receiptData,
      productId: actualProductId,
    });

    await payment.save();

    // Grant verified badge
    await grantVerifiedBadge(userId, expirationDate);

    logger.info(`Apple purchase verified for user ${userId}, transaction: ${transactionId}`);

    return {
      verified: true,
      subscription: {
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        plan: {
          id: plan._id,
          name: plan.name,
          billingCycle: plan.billingCycle,
        },
      },
      payment: {
        transactionId: transactionId,
        amount: payment.amount,
        currency: payment.currency,
      },
    };
  } catch (error) {
    logger.error("Apple purchase verification error:", error);
    throw error;
  }
};

/**
 * Verify and process Google Play Store purchase
 * @param {string} userId - User ID
 * @param {string} packageName - App package name
 * @param {string} productId - Product ID (SKU)
 * @param {string} purchaseToken - Purchase token
 * @param {string} orderId - Order ID (optional, for restore purchases)
 * @returns {Promise<Object>} Verification result
 */
export const verifyGooglePurchase = async (
  userId,
  packageName,
  productId,
  purchaseToken,
  orderId = null
) => {
  try {
    // Verify purchase with Google
    // Note: This requires proper Google Play API integration
    // For now, we'll use a simplified approach
    // In production, implement full Google Play Developer API integration
    
    const transactionId = orderId || purchaseToken; // Use orderId if provided, else purchaseToken

    // Check for duplicate transaction
    const existingPayment = await SubscriptionPayment.findOne({
      transactionId: transactionId,
      paymentProvider: PAYMENT_PROVIDERS.GOOGLE,
    });

    if (existingPayment) {
      // Transaction already processed
      const subscription = await UserSubscription.findById(
        existingPayment.subscriptionId
      ).populate("planId");

      return {
        verified: true,
        alreadyProcessed: true,
        subscription: {
          status: subscription.status,
          endDate: subscription.endDate,
          plan: subscription.planId,
        },
      };
    }

    // TODO: Implement actual Google Play verification
    // const purchaseData = await verifyGooglePurchase(packageName, productId, purchaseToken);
    
    // For now, we'll proceed with basic validation
    // In production, verify the purchase with Google Play API first

    // Find or create subscription plan
    const plan = await findPlanByProductId(productId, "google");

    // Calculate expiration date
    const expirationDate = calculateExpirationDate(plan.billingCycle);

    // Create user subscription
    const subscription = new UserSubscription({
      userId,
      planId: plan._id,
      status: SubscriptionStatus.ACTIVE,
      startDate: new Date(),
      endDate: expirationDate,
    });

    await subscription.save();

    // Create payment record
    const payment = new SubscriptionPayment({
      userId,
      subscriptionId: subscription._id,
      amount: plan.price,
      currency: plan.currency,
      paymentProvider: PAYMENT_PROVIDERS.GOOGLE,
      transactionId: transactionId,
      status: SubscriptionStatus.ACTIVE,
      receiptData: purchaseToken,
      productId: productId,
      packageName: packageName,
      orderId: orderId,
    });

    await payment.save();

    // Grant verified badge
    await grantVerifiedBadge(userId, expirationDate);

    logger.info(`Google purchase verified for user ${userId}, transaction: ${transactionId}`);

    return {
      verified: true,
      subscription: {
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        plan: {
          id: plan._id,
          name: plan.name,
          billingCycle: plan.billingCycle,
        },
      },
      payment: {
        transactionId: transactionId,
        amount: payment.amount,
        currency: payment.currency,
      },
    };
  } catch (error) {
    logger.error("Google purchase verification error:", error);
    throw error;
  }
};

/**
 * Restore purchases for a user
 * @param {string} userId - User ID
 * @param {string} platform - Platform (apple or google)
 * @returns {Promise<Array>} List of restored subscriptions
 */
export const restorePurchases = async (userId, platform) => {
  try {
    // Get all active subscriptions for the user
    const subscriptions = await UserSubscription.find({
      userId,
      status: SubscriptionStatus.ACTIVE,
    }).populate("planId");

    const payments = await SubscriptionPayment.find({
      userId,
      paymentProvider: platform === "apple" ? PAYMENT_PROVIDERS.APPLE : PAYMENT_PROVIDERS.GOOGLE,
      status: SubscriptionStatus.ACTIVE,
    }).populate("subscriptionId");

    // Filter out expired subscriptions
    const activeSubscriptions = subscriptions.filter((sub) => {
      const now = new Date();
      return sub.endDate > now;
    });

    // Update expired subscriptions
    for (const sub of subscriptions) {
      if (sub.endDate <= new Date() && sub.status === SubscriptionStatus.ACTIVE) {
        sub.status = SubscriptionStatus.EXPIRED;
        await sub.save();
        await revokeVerifiedBadge(userId);
      }
    }

    return activeSubscriptions.map((sub) => ({
      status: sub.status,
      startDate: sub.startDate,
      endDate: sub.endDate,
      plan: {
        id: sub.planId._id,
        name: sub.planId.name,
        billingCycle: sub.planId.billingCycle,
      },
    }));
  } catch (error) {
    logger.error("Restore purchases error:", error);
    throw error;
  }
};

/**
 * Expire verified badges for users whose subscriptions have ended
 * This should be called periodically via cron job
 */
export const expireVerifiedBadges = async () => {
  try {
    const now = new Date();

    // Find all active subscriptions that have expired
    const expiredSubscriptions = await UserSubscription.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $lte: now },
    });

    logger.info(`Found ${expiredSubscriptions.length} expired subscriptions to process`);

    // Update subscription status and revoke badges
    for (const subscription of expiredSubscriptions) {
      subscription.status = SubscriptionStatus.EXPIRED;
      await subscription.save();

      await revokeVerifiedBadge(subscription.userId);

      // Update related payments
      await SubscriptionPayment.updateMany(
        { subscriptionId: subscription._id, status: SubscriptionStatus.ACTIVE },
        { $set: { status: SubscriptionStatus.EXPIRED } }
      );
    }

    logger.info(`Successfully processed ${expiredSubscriptions.length} expired subscriptions`);
    return { processed: expiredSubscriptions.length };
  } catch (error) {
    logger.error("Expire verified badges error:", error);
    throw error;
  }
};

/**
 * Get user's verified status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Verified status information
 */
export const getUserVerifiedStatus = async (userId) => {
  try {
    const user = await User.findById(userId).select("isVerifiedBadge");
    if (!user) {
      throw new Error("User not found");
    }

    // Get active subscription
    const activeSubscription = await UserSubscription.findOne({
      userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gt: new Date() },
    }).populate("planId");

    return {
      isVerifiedBadge: user.isVerifiedBadge,
      subscription: activeSubscription
        ? {
            status: activeSubscription.status,
            startDate: activeSubscription.startDate,
            endDate: activeSubscription.endDate,
            plan: {
              id: activeSubscription.planId._id,
              name: activeSubscription.planId.name,
              billingCycle: activeSubscription.planId.billingCycle,
            },
          }
        : null,
    };
  } catch (error) {
    logger.error("Get user verified status error:", error);
    throw error;
  }
};
