import cron from "node-cron";
import { processExpiredSubscriptions } from "../services/subscription.service.js";
import logger from "../utils/logger.js";

/**
 * Cron job to check and process expired subscriptions
 * Runs every hour at minute 0 (e.g., 1:00, 2:00, 3:00, etc.)
 */
const subscriptionExpiryJob = cron.schedule("0 * * * *", async () => {
  try {
    logger.info("Running subscription expiry check job...");
    const result = await processExpiredSubscriptions();
    logger.info(
      `Subscription expiry job completed. Processed: ${result.processed}, Errors: ${result.errors?.length || 0}`
    );
  } catch (error) {
    logger.error("Error in subscription expiry job:", error);
  }
});

/**
 * Start the subscription expiry cron job
 */
export const startSubscriptionExpiryJob = () => {
  subscriptionExpiryJob.start();
  logger.info("Subscription expiry cron job started (runs every hour)");
};

/**
 * Stop the subscription expiry cron job
 */
export const stopSubscriptionExpiryJob = () => {
  subscriptionExpiryJob.stop();
  logger.info("Subscription expiry cron job stopped");
};

export default {
  startSubscriptionExpiryJob,
  stopSubscriptionExpiryJob,
};

