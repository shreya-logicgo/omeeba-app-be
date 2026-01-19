import cron from "node-cron";
import { calculatePollResults, getExpiredPolls } from "./poll.service.js";
import logger from "../utils/logger.js";

/**
 * Start cron job to auto-calculate poll results
 * Runs every minute to check for expired polls
 */
export const startPollCronJob = () => {
  // Run every minute: * * * * *
  cron.schedule("* * * * *", async () => {
    try {
      logger.info("Running poll expiration check cron job...");

      // Get all expired polls that need result calculation
      const expiredPollIds = await getExpiredPolls();

      if (expiredPollIds.length === 0) {
        logger.debug("No expired polls found");
        return;
      }

      logger.info(`Found ${expiredPollIds.length} expired poll(s) to process`);

      // Calculate results for each expired poll
      const promises = expiredPollIds.map((pollId) =>
        calculatePollResults(pollId).catch((error) => {
          logger.error(`Error calculating results for poll ${pollId}:`, error);
          return null;
        })
      );

      await Promise.all(promises);

      logger.info(
        `Successfully processed ${expiredPollIds.length} expired poll(s)`
      );
    } catch (error) {
      logger.error("Error in poll expiration cron job:", error);
    }
  });

  logger.info("Poll expiration cron job started (runs every minute)");
};

export default {
  startPollCronJob,
};

