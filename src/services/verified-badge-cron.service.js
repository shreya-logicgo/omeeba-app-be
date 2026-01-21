import cron from "node-cron";
import { expireVerifiedBadges } from "./purchase-verification.service.js";
import logger from "../utils/logger.js";

/**
 * Start cron job to expire verified badges
 * Runs every hour to check for expired subscriptions
 */
export const startVerifiedBadgeCronJob = () => {
  // Run every hour at minute 0: 0 * * * *
  cron.schedule("0 * * * *", async () => {
    try {
      logger.info("Running verified badge expiration check cron job...");

      const result = await expireVerifiedBadges();

      if (result.processed === 0) {
        logger.debug("No expired verified badges found");
        return;
      }

      logger.info(
        `Successfully processed ${result.processed} expired verified badge(s)`
      );
    } catch (error) {
      logger.error("Error in verified badge expiration cron job:", error);
    }
  });

  logger.info("Verified badge expiration cron job started (runs every hour)");
};

export default {
  startVerifiedBadgeCronJob,
};
