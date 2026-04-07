import logger from '../utils/logger.js';
import { sendError } from '../utils/response.js';
import { StatusCodes } from 'http-status-codes';

/**
 * Validate Google Play Developer Notification
 * Google Play doesn't provide signature verification, so we validate the structure
 */
export const validateGoogleWebhook = (req, res, next) => {
  try {
    const body = req.body;

    // Check if body exists
    if (!body) {
      logger.error('Google webhook: No request body');
      return sendError(
        res,
        "No request body",
        "Invalid Webhook",
        null,
        StatusCodes.BAD_REQUEST
      );
    }

    // Validate required fields for real notifications
    if (body.subscriptionNotification) {
      const { subscriptionNotification } = body;
      
      if (!subscriptionNotification.notificationType) {
        logger.error('Google webhook: Missing notificationType');
        return sendError(
          res,
          "Missing notificationType",
          "Invalid Webhook",
          null,
          StatusCodes.BAD_REQUEST
        );
      }

      if (!subscriptionNotification.purchaseToken) {
        logger.error('Google webhook: Missing purchaseToken');
        return sendError(
          res,
          "Missing purchaseToken",
          "Invalid Webhook",
          null,
          StatusCodes.BAD_REQUEST
        );
      }

      if (!subscriptionNotification.subscriptionId) {
        logger.error('Google webhook: Missing subscriptionId');
        return sendError(
          res,
          "Missing subscriptionId",
          "Invalid Webhook",
          null,
          StatusCodes.BAD_REQUEST
        );
      }

      // Validate notification type
      const validNotificationTypes = [
        'SUBSCRIPTION_RECOVERED',
        'SUBSCRIPTION_RENEWED',
        'SUBSCRIPTION_CANCELED',
        'SUBSCRIPTION_PURCHASED',
        'SUBSCRIPTION_ON_HOLD',
        'SUBSCRIPTION_IN_GRACE_PERIOD',
        'SUBSCRIPTION_RESTARTED',
        'SUBSCRIPTION_EXPIRED',
        'SUBSCRIPTION_REVOKED'
      ];

      if (!validNotificationTypes.includes(subscriptionNotification.notificationType)) {
        logger.warn(`Google webhook: Unknown notification type: ${subscriptionNotification.notificationType}`);
        // Don't reject unknown types, just log and continue
      }
    }

    // Validate test notification structure
    if (body.testNotification) {
      const { testNotification } = body;
      
      if (!testNotification.version) {
        logger.error('Google webhook: Missing test notification version');
        return sendError(
          res,
          "Missing test notification version",
          "Invalid Webhook",
          null,
          StatusCodes.BAD_REQUEST
        );
      }
    }

    // Log basic webhook info for debugging
    logger.info('Google webhook validation passed:', {
      hasSubscriptionNotification: !!body.subscriptionNotification,
      hasTestNotification: !!body.testNotification,
      packageName: body.packageName,
      version: body.version
    });

    next();
  } catch (error) {
    logger.error('Google webhook validation error:', error);
    return sendError(
      res,
      "Webhook validation failed",
      "Validation Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Basic rate limiting for Google Play webhooks
 * Since Google Play retries on failure, we should implement basic protection
 */
const webhookAttempts = new Map();

export const googleWebhookRateLimit = (req, res, next) => {
  const clientIp = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100; // Max 100 requests per minute

  // Clean old entries
  for (const [ip, attempts] of webhookAttempts.entries()) {
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    if (validAttempts.length === 0) {
      webhookAttempts.delete(ip);
    } else {
      webhookAttempts.set(ip, validAttempts);
    }
  }

  // Check current IP attempts
  const attempts = webhookAttempts.get(clientIp) || [];
  const recentAttempts = attempts.filter(timestamp => now - timestamp < windowMs);

  if (recentAttempts.length >= maxRequests) {
    logger.warn(`Google webhook rate limit exceeded for IP: ${clientIp}`);
    return sendError(
      res,
      "Rate limit exceeded",
      "Too Many Requests",
      null,
      StatusCodes.TOO_MANY_REQUESTS
    );
  }

  // Add current attempt
  recentAttempts.push(now);
  webhookAttempts.set(clientIp, recentAttempts);

  next();
};
