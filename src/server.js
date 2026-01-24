import app from "./app.js";
import { connectDB } from "./config/database.js";
import logger from "./utils/logger.js";
import config from "./config/env.js";
import { startPollCronJob } from "./services/poll-cron.service.js";
import { startVerifiedBadgeCronJob } from "./services/verified-badge-cron.service.js";
import { startSavedContentCleanupCronJob } from "./services/saved-content-cron.service.js";
import { initializeSocket } from "./socket/socket.js";

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  logger.error("UNCAUGHT EXCEPTION! Shutting down...");
  logger.error(err.name, err.message);
  process.exit(1);
});

// Connect to database
connectDB();

// Start poll cron job for auto-calculating poll results
startPollCronJob();

// Start verified badge expiration cron job
startVerifiedBadgeCronJob();

// Start saved content cleanup cron job
startSavedContentCleanupCronJob();

// Start server
const server = app.listen(config.port, () => {
  logger.info(
    `Server running in ${config.nodeEnv} mode on port ${config.port}`
  );
});

// Initialize Socket.IO
const io = initializeSocket(server);
logger.info("Socket.IO server initialized");

// Export io for use in other modules if needed
export { io };

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  logger.error("UNHANDLED REJECTION! Shutting down...");
  logger.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    logger.info("Process terminated!");
  });
});

export default server;
