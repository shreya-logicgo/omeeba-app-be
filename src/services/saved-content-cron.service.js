import cron from "node-cron";
import { cleanupStaleSavedContent } from "./saved-content.service.js";
import logger from "../utils/logger.js";

/**
 * Start cron job to clean up stale saved content references
 * Runs daily at 2 AM to remove saved content for deleted/unavailable items
 */
export const startSavedContentCleanupCronJob = () => {
  // Run daily at 2 AM: 0 2 * * *
  cron.schedule("0 2 * * *", async () => {
    try {
      logger.info("Running saved content cleanup cron job...");

      const result = await cleanupStaleSavedContent();

      if (result.cleanedCount === 0) {
        logger.debug("No stale saved content references found");
        return;
      }

      logger.info(
        `Successfully cleaned up ${result.cleanedCount} stale saved content reference(s)`
      );
    } catch (error) {
      logger.error("Error in saved content cleanup cron job:", error);
    }
  });

  logger.info("Saved content cleanup cron job started (runs daily at 2 AM)");
};

export default {
  startSavedContentCleanupCronJob,
};

