import cron from "node-cron";
import UserSubscription from "../models/subscriptions/UserSubscription.js";
import { SubscriptionStatus } from "../models/enums.js";
import { verifySubscriptionStatus } from "./apple-subscription.service.js";
import logger from "../utils/logger.js";

/**
 * Start cron job to verify Apple subscriptions hourly
 * Runs every hour at the 0th minute: 0 * * * *
 */
export const startAppleSubscriptionCronJob = () => {
  // Run every hour: 0 * * * *
  cron.schedule("0 * * * *", async () => {
    try {
      logger.info("Running Apple subscription verification cron job...");

      // Find all active Apple subscriptions that need verification
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const subscriptions = await UserSubscription.find({
        originalTransactionId: { $exists: true, $ne: null },
        status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] },
        $or: [
          { lastVerifiedAt: { $lt: oneHourAgo } },
          { lastVerifiedAt: { $exists: false } }
        ]
      }).populate('userId planId');

      if (subscriptions.length === 0) {
        logger.debug("No Apple subscriptions need verification");
        return;
      }

      logger.info(`Found ${subscriptions.length} Apple subscription(s) to verify`);

      // Verify each subscription
      const verificationPromises = subscriptions.map(async (subscription) => {
        try {
          await verifySubscriptionStatus(subscription);
          return { success: true, subscriptionId: subscription._id };
        } catch (error) {
          logger.error(`Error verifying subscription ${subscription._id}:`, error);
          return { success: false, subscriptionId: subscription._id, error: error.message };
        }
      });

      const results = await Promise.all(verificationPromises);
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info(`Apple subscription verification completed: ${successful} successful, ${failed} failed`);

      // Handle expired subscriptions that might need cleanup
      await handleExpiredSubscriptions();

    } catch (error) {
      logger.error("Error in Apple subscription verification cron job:", error);
    }
  });

  logger.info("Apple subscription verification cron job started (runs every hour)");
};

/**
 * Handle expired subscriptions and cleanup
 */
const handleExpiredSubscriptions = async () => {
  try {
    const now = new Date();
    
    // Find subscriptions that should be expired but aren't marked as such
    const expiredSubscriptions = await UserSubscription.find({
      originalTransactionId: { $exists: true, $ne: null },
      status: { $nin: [SubscriptionStatus.EXPIRED, SubscriptionStatus.CANCELLED] },
      expiresAt: { $lt: now }
    }).populate('userId');

    if (expiredSubscriptions.length === 0) {
      return;
    }

    logger.info(`Found ${expiredSubscriptions.length} subscriptions to mark as expired`);

    for (const subscription of expiredSubscriptions) {
      subscription.status = SubscriptionStatus.EXPIRED;
      if (!subscription.cancellationReason) {
        subscription.cancellationReason = 'EXPIRED_INTENTIONALLY';
      }
      await subscription.save();

      logger.info(`Marked subscription as expired for user: ${subscription.userId._id}`);
    }

  } catch (error) {
    logger.error("Error handling expired subscriptions:", error);
  }
};

/**
 * Manually trigger subscription verification for testing
 */
export const triggerSubscriptionVerification = async () => {
  try {
    logger.info("Manually triggering Apple subscription verification...");
    
    const subscriptions = await UserSubscription.find({
      originalTransactionId: { $exists: true, $ne: null },
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] }
    }).populate('userId planId');

    if (subscriptions.length === 0) {
      logger.info("No Apple subscriptions found for verification");
      return;
    }

    logger.info(`Verifying ${subscriptions.length} Apple subscriptions...`);

    const verificationPromises = subscriptions.map(async (subscription) => {
      try {
        const updatedSubscription = await verifySubscriptionStatus(subscription);
        return { 
          success: true, 
          subscriptionId: subscription._id,
          oldStatus: subscription.status,
          newStatus: updatedSubscription.status
        };
      } catch (error) {
        logger.error(`Error verifying subscription ${subscription._id}:`, error);
        return { success: false, subscriptionId: subscription._id, error: error.message };
      }
    });

    const results = await Promise.all(verificationPromises);
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const statusChanges = successful.filter(r => r.oldStatus !== r.newStatus);

    logger.info(`Manual verification completed: ${successful.length} successful, ${failed.length} failed`);
    
    if (statusChanges.length > 0) {
      logger.info(`Status changes: ${statusChanges.length} subscriptions updated`);
      statusChanges.forEach(change => {
        logger.info(`  Subscription ${change.subscriptionId}: ${change.oldStatus} -> ${change.newStatus}`);
      });
    }

    return results;

  } catch (error) {
    logger.error("Error in manual subscription verification:", error);
    throw error;
  }
};

export default {
  startAppleSubscriptionCronJob,
  triggerSubscriptionVerification
};
