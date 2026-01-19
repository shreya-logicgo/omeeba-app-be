import app from "./app.js";
import { connectDB } from "./config/database.js";
import logger from "./utils/logger.js";
import config from "./config/env.js";
import { startPollCronJob } from "./services/poll-cron.service.js";

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

// Start server
const server = app.listen(config.port, () => {
  logger.info(
    `Server running in ${config.nodeEnv} mode on port ${config.port}`
  );
});

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
