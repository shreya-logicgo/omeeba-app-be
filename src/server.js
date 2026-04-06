import app from "./app.js";
import { connectDB } from "./config/database.js";
import logger from "./utils/logger.js";
import config from "./config/env.js";
import { startPollCronJob } from "./services/poll-cron.service.js";
import { startVerifiedBadgeCronJob } from "./services/verified-badge-cron.service.js";
import { startSavedContentCleanupCronJob } from "./services/saved-content-cron.service.js";
import { startAppleSubscriptionCronJob } from "./services/apple-subscription-cron.service.js";
import { initializeSocket } from "./socket/socket.js";

/**
 * Check OpenSSL compatibility and log warnings if needed
 */
const checkOpenSSLCompatibility = () => {
  const nodeVersion = process.version;
  const opensslVersion = process.versions.openssl;
  const nodeMajorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  const hasLegacyProvider = process.env.NODE_OPTIONS?.includes('--openssl-legacy-provider');
  
  logger.info('System Information:', {
    nodeVersion,
    opensslVersion,
    nodeMajorVersion,
    hasLegacyProvider,
    nodeOptions: process.env.NODE_OPTIONS || 'Not set'
  });
  
  if (nodeMajorVersion >= 17 && !hasLegacyProvider) {
    logger.warn('⚠️  OpenSSL 3 Compatibility Warning:');
    logger.warn(`Node.js ${nodeVersion} detected with OpenSSL ${opensslVersion}`);
    logger.warn('Google Play purchase verification may fail with OpenSSL decoding errors');
    logger.warn('Solution: Run with NODE_OPTIONS=--openssl-legacy-provider');
    logger.warn('Example: NODE_OPTIONS=--openssl-legacy-provider npm start');
  } else if (hasLegacyProvider) {
    logger.info('✅ OpenSSL legacy provider is enabled');
  } else {
    logger.info('✅ Node.js version is compatible with current OpenSSL version');
  }
};

// Check OpenSSL compatibility on startup
checkOpenSSLCompatibility();

// Connect to database
connectDB();

// Start poll cron job for auto-calculating poll results
startPollCronJob();

// Start verified badge expiration cron job
startVerifiedBadgeCronJob();

// Start saved content cleanup cron job
startSavedContentCleanupCronJob();

// Start Apple subscription verification cron job
startAppleSubscriptionCronJob();

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
