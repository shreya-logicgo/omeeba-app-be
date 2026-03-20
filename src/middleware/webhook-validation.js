import logger from "../utils/logger.js";

/**
 * Middleware to validate webhook requests
 * This can be extended with specific validation logic for different webhook providers
 */
export const validateWebhook = (req, res, next) => {
  try {
    // Log incoming webhook request
    logger.info("Webhook request received:", {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // Basic validation for POST requests
    if (req.method === 'POST') {
      const contentType = req.get('Content-Type');
      
      if (!contentType || !contentType.includes('application/json')) {
        logger.warn("Webhook request with invalid content-type:", contentType);
        return res.status(400).json({
          error: "Invalid content-type",
          message: "Content-Type must be application/json"
        });
      }

      // Check if body exists
      if (!req.body || Object.keys(req.body).length === 0) {
        logger.warn("Webhook request with empty body");
        return res.status(400).json({
          error: "Empty request body",
          message: "Request body is required"
        });
      }
    }

    next();
  } catch (error) {
    logger.error("Error in webhook validation middleware:", error);
    return res.status(500).json({
      error: "Validation error",
      message: "Internal server error during validation"
    });
  }
};

/**
 * Middleware specifically for Apple webhooks
 */
export const validateAppleWebhook = (req, res, next) => {
  try {
    // Check for Apple-specific headers
    const appleHeaders = {
      'x-apple-signature': req.get('x-apple-signature'),
      'x-apple-certificate': req.get('x-apple-certificate'),
      'user-agent': req.get('user-agent')
    };

    logger.info("Apple webhook headers:", appleHeaders);

    // Verify required fields for Apple notifications
    const { signedPayload, signature } = req.body;

    if (!signedPayload) {
      logger.error("Apple webhook missing signedPayload");
      return res.status(400).json({
        error: "Missing signedPayload",
        message: "signedPayload is required"
      });
    }

    if (!signature) {
      logger.error("Apple webhook missing signature");
      return res.status(400).json({
        error: "Missing signature",
        message: "signature is required"
      });
    }

    // Validate signedPayload format (should be base64)
    try {
      const decoded = Buffer.from(signedPayload, 'base64').toString();
      JSON.parse(decoded);
    } catch (error) {
      logger.error("Apple webhook invalid signedPayload format:", error);
      return res.status(400).json({
        error: "Invalid signedPayload",
        message: "signedPayload must be valid base64-encoded JSON"
      });
    }

    next();
  } catch (error) {
    logger.error("Error in Apple webhook validation:", error);
    return res.status(500).json({
      error: "Validation error",
      message: "Internal server error during Apple webhook validation"
    });
  }
};

export default {
  validateWebhook,
  validateAppleWebhook
};
