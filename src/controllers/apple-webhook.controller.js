import appleSubscriptionService from "../services/apple-subscription.service.js";
const { handleAppStoreNotification, verifyAppleNotification } = appleSubscriptionService;
import { sendSuccess, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Handle Apple App Store Server Notification
 * This endpoint receives notifications from Apple about subscription events
 */
export const handleAppleWebhook = async (req, res) => {
  try {
    const { signedPayload, signature } = req.body;

    // Verify the notification signature
    if (!signedPayload || !signature) {
      logger.error("Apple webhook missing required fields: signedPayload or signature");
      return sendError(
        res,
        "Missing required notification data",
        "Invalid Webhook",
        null,
        StatusCodes.BAD_REQUEST
      );
    }

    // Verify the signature to ensure the notification is from Apple
    const isValidSignature = verifyAppleNotification(signedPayload, signature);
    if (!isValidSignature) {
      logger.error("Invalid Apple webhook signature");
      return sendError(
        res,
        "Invalid signature",
        "Authentication Failed",
        null,
        StatusCodes.UNAUTHORIZED
      );
    }

    // Parse the signed payload
    let notificationData;
    try {
      notificationData = JSON.parse(Buffer.from(signedPayload, 'base64').toString());
    } catch (error) {
      logger.error("Error parsing Apple notification payload:", error);
      return sendError(
        res,
        "Invalid payload format",
        "Parse Error",
        null,
        StatusCodes.BAD_REQUEST
      );
    }

    // Process the notification
    await handleAppStoreNotification(notificationData);

    // Return success response to Apple
    return sendSuccess(
      res,
      { received: true },
      "Notification processed successfully",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error handling Apple webhook:", error);
    
    // Still return 200 to Apple to avoid retry spam, but log the error
    return sendSuccess(
      res,
      { received: true, error: "Internal processing error" },
      "Notification received but processing failed",
      StatusCodes.OK
    );
  }
};

/**
 * Test endpoint for Apple webhooks
 */
export const testAppleWebhook = async (req, res) => {
  try {
    logger.info("Apple webhook test endpoint called");
    
    return sendSuccess(
      res,
      { 
        message: "Apple webhook endpoint is working",
        timestamp: new Date().toISOString(),
        method: req.method,
        userAgent: req.get('User-Agent')
      },
      "Webhook test successful",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error in Apple webhook test:", error);
    return sendError(
      res,
      "Test failed",
      "Webhook Test Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Health check for webhook service
 */
export const webhookHealthCheck = async (req, res) => {
  try {
    return sendSuccess(
      res,
      {
        status: "healthy",
        service: "apple-webhook",
        timestamp: new Date().toISOString(),
        version: "1.0.0"
      },
      "Webhook service is healthy",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Error in webhook health check:", error);
    return sendError(
      res,
      "Health check failed",
      "Service Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
