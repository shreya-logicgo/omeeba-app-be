import {
  verifyApplePurchase,
  verifyGooglePurchase,
  verifyGooglePurchaseToken,
  restorePurchases,
  getUserVerifiedStatus,
  initializeGoogleAuth,
} from "../services/purchase-verification.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
} from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";


/**
 * Verify Apple App Store purchase
 * @route POST /api/v1/purchases/verify/apple
 * @access Private
 */
export const verifyApplePurchaseController = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { receiptData, productId, receiptFormat } = req.body;

    if (!receiptData) {
      return sendBadRequest(res, "Receipt data is required");
    }

    // Auto-detect format if not provided
    const detectedFormat = receiptFormat || (receiptData.startsWith('eyJ') ? 'JWT' : 'Base64');
    logger.info(`Verifying Apple purchase with format: ${detectedFormat}`);

    const result = await verifyApplePurchase(userId, receiptData, productId, detectedFormat);

    return sendSuccess(
      res,
      {
        verified: result.verified,
        alreadyProcessed: result.alreadyProcessed || false,
        subscription: result.subscription,
        payment: result.payment,
      },
      result.alreadyProcessed
        ? "Purchase already processed"
        : "Purchase verified successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Verify Apple purchase controller error:", error);

    if (error.message.includes("duplicate") || error.message.includes("already")) {
      return sendBadRequest(res, error.message);
    }

    if (error.message.includes("Invalid") || error.message.includes("verification failed")) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to verify Apple purchase",
      "Verification Error",
      error.message || "An error occurred while verifying purchase",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Verify Google Play Store purchase
 * @route POST /api/v1/purchases/verify/google
 * @access Private
 */
export const verifyGooglePurchaseController = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { packageName, productId, purchaseToken, orderId } = req.body;

    // Validate required inputs
    if (!userId) {
      return sendBadRequest(res, "User ID is required");
    }

    if (!packageName || !productId || !purchaseToken) {
      return sendBadRequest(
        res,
        "Package name, product ID, and purchase token are required"
      );
    }

    // Validate input formats
    if (typeof packageName !== 'string' || packageName.trim().length === 0) {
      return sendBadRequest(res, "Package name must be a non-empty string");
    }

    if (typeof productId !== 'string' || productId.trim().length === 0) {
      return sendBadRequest(res, "Product ID must be a non-empty string");
    }

    if (typeof purchaseToken !== 'string' || purchaseToken.trim().length === 0) {
      return sendBadRequest(res, "Purchase token must be a non-empty string");
    }

    const result = await verifyGooglePurchase(
      userId,
      packageName,
      productId,
      purchaseToken,
      orderId
    );

    return sendSuccess(
      res,
      {
        verified: result.verified,
        alreadyProcessed: result.alreadyProcessed || false,
        subscription: result.subscription,
        payment: result.payment,
      },
      result.alreadyProcessed
        ? "Purchase already processed"
        : "Purchase verified successfully",
      StatusCodes.OK
    );
  } catch (error) {
    // Handle structured errors from service
    if (error.errorType) {
      logger.error("Google purchase verification failed:", {
        errorType: error.errorType,
        message: error.message,
        debugStep: error.debugStep,
        needsConfigFix: error.needsConfigFix,
        userId: req.user?._id,
        packageName: req.body?.packageName,
        productId: req.body?.productId
      });

      // Return appropriate response based on error type
      switch (error.errorType) {
        case "VALIDATION_ERROR":
          return sendBadRequest(res, error.message);
          
        case "INVALID_CREDENTIALS":
          return sendError(
            res,
            "Google service account credentials are invalid or missing",
            "Credentials Error",
            "Please check your Google service account configuration",
            StatusCodes.INTERNAL_SERVER_ERROR
          );
          
        case "OPENSSL_ERROR":
          const errorResponse = {
            success: false,
            errorType: "OPENSSL_ERROR",
            message: "OpenSSL decoding failed during Google JWT signing",
            fix: "Run app with NODE_OPTIONS=--openssl-legacy-provider or use Node 16 LTS",
            nodeVersion: error.nodeVersion || process.version,
            opensslVersion: error.opensslVersion || process.versions.openssl,
            hasLegacyProvider: error.hasLegacyProvider || process.env.NODE_OPTIONS?.includes('--openssl-legacy-provider'),
            debugStep: error.debugStep,
            strategy: error.strategy || 'unknown'
          };
          
          // If legacy provider is already enabled, suggest different solutions
          if (errorResponse.hasLegacyProvider) {
            errorResponse.fix = "Legacy provider already enabled. Try downgrading to Node.js 16 LTS OR regenerate Google service account key with different format";
            errorResponse.legacyProviderEnabled = true;
          }
          
          // Add specific recommendations based on strategy
          if (error.strategy === 'Legacy Provider Warning') {
            errorResponse.fix = "Enable legacy provider with NODE_OPTIONS=--openssl-legacy-provider";
          }
          
          return sendError(
            res,
            errorResponse,
            "Authentication Error",
            error.fix || "OpenSSL compatibility issue detected",
            StatusCodes.INTERNAL_SERVER_ERROR
          );
          
        case "AUTH_ERROR":
          const message = error.needsConfigFix 
            ? "Google Play Console permissions need to be configured"
            : "Google authentication failed";
          return sendError(
            res,
            message,
            "Authentication Error",
            error.message,
            StatusCodes.INTERNAL_SERVER_ERROR
          );
          
        case "INVALID_PURCHASE":
          return sendBadRequest(res, error.message);
          
        case "API_ERROR":
          return sendError(
            res,
            "Google Play API error occurred",
            "API Error",
            error.message,
            StatusCodes.INTERNAL_SERVER_ERROR
          );
          
        default:
          return sendError(
            res,
            "Google purchase verification failed",
            "Verification Error",
            error.message,
            StatusCodes.INTERNAL_SERVER_ERROR
          );
      }
    }

    // Handle legacy/unstructured errors
    const errorInfo = {
      timestamp: new Date().toISOString(),
      service: 'omeeba-backend',
      component: 'purchase-verification-controller',
      action: 'verify_google_purchase',
      status: 'error',
      request: {
        userId: req.user?._id,
        packageName: req.body?.packageName,
        productId: req.body?.productId,
        purchaseTokenLength: req.body?.purchaseToken?.length || 0,
        purchaseTokenPreview: req.body?.purchaseToken ? req.body.purchaseToken.substring(0, req.body.purchaseToken.length - 6) + '******' : 'MISSING',
        orderId: req.body?.orderId
      },
      error: {
        message: error.message,
        code: error.code,
        status: error.status,
        stack: error.stack
      }
    };

    let errorType = 'UNKNOWN_ERROR';
    if (error.code === 401 || error.status === 401 || error.message?.includes('insufficient permissions')) {
      errorType = 'AUTH_ERROR';
    } else if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      errorType = 'INVALID_CREDENTIALS';
    } else if (error.message?.includes('OpenSSL') || error.message?.includes('DECODER')) {
      errorType = 'OPENSSL_ERROR';
    } else if (error.message?.includes('API') || error.message?.includes('access')) {
      errorType = 'API_ACCESS_ERROR';
    }

    errorInfo.errorType = errorType;

    if (error.code === 401 || error.status === 401) {
      errorInfo.analysis = {
        issue: 'Service account lacks required permissions',
        solution: 'Check Google Play Console → API Access → Android Publisher API',
        requiredPermissions: ['Android Publisher API access', 'Play Management or Finance permissions'],
        domain: 'androidpublisher',
        reason: 'permissionDenied',
        notCodeIssue: true
      };
    }
    
    if (error.message?.includes('insufficient permissions')) {
      errorInfo.analysis = {
        issue: 'Service account is authenticated but lacks Android Publisher API permissions',
        solution: 'Grant proper permissions in Google Play Console',
        authenticationStatus: 'SUCCESS',
        authorizationStatus: 'FAILED'
      };
    }
    
    if (error.message?.includes('permissionDenied')) {
      errorInfo.analysis = {
        domain: 'androidpublisher',
        reason: 'permissionDenied',
        rootCause: 'Google Play Console configuration issue',
        notCodeIssue: true
      };
    }

    logger.error('CONTROLLER_ERROR', errorInfo);

    // Check for specific error types that should return bad request
    if (error.message.includes("duplicate") || error.message.includes("already")) {
      return sendBadRequest(res, error.message);
    }

    if (error.message.includes("Invalid") || error.message.includes("verification failed")) {
      return sendBadRequest(res, error.message);
    }

    // Return generic error for unhandled cases
    return sendError(
      res,
      "Failed to verify Google purchase",
      "Verification Error",
      error.message || "An error occurred while verifying purchase",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Restore purchases for a user
 * @route GET /api/v1/purchases/restore
 * @access Private
 */
export const restorePurchasesController = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { platform } = req.query; // 'apple' or 'google'

    if (!platform || !["apple", "google"].includes(platform.toLowerCase())) {
      return sendBadRequest(res, "Valid platform (apple or google) is required");
    }

    const subscriptions = await restorePurchases(userId, platform.toLowerCase());

    return sendSuccess(
      res,
      {
        subscriptions,
      },
      "Purchases restored successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Restore purchases controller error:", error);

    return sendError(
      res,
      "Failed to restore purchases",
      "Restore Error",
      error.message || "An error occurred while restoring purchases",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get user's verified status
 * @route GET /api/v1/purchases/status
 * @access Private
 */
export const getVerifiedStatusController = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const status = await getUserVerifiedStatus(userId);

    return sendSuccess(
      res,
      {
        verified: status,
      },
      "Verified status retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get verified status controller error:", error);

    if (error.message === "User not found") {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to get verified status",
      "Status Error",
      error.message || "An error occurred while retrieving verified status",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Test Google service account configuration
 * @route GET /api/v1/purchases/test/google-config
 * @access Private
 */
export const testGoogleConfigController = async (req, res) => {
  try {
    let configStatus = {
      hasCredentials: false,
      credentialsValid: false,
      authWorking: false,
      error: null,
      credentialsType: 'file_based'
    };

    // Test file-based Google Auth initialization
    try {
      const auth = await initializeGoogleAuth();
      configStatus.hasCredentials = true;
      configStatus.credentialsValid = true;
      
      // Test authentication
      const authClient = await auth.getClient();
      configStatus.authWorking = true;
      
      return sendSuccess(res, {
        configStatus,
        message: "Google service account configuration is valid using file-based credentials"
      }, "Google service account configuration is valid");
      
    } catch (error) {
      configStatus.error = error.message;
      configStatus.fix = error.fix || "Check config/google-service-account.json file";
      
      return sendError(
        res, 
        "Google service account configuration error", 
        "Config Error", 
        `${error.message}. ${error.fix || ''}`
      );
    }
  } catch (error) {
    logger.error("Test Google config error:", error);
    return sendError(res, "Failed to test Google configuration", "Test Error", error.message);
  }
};

export default {
  verifyApplePurchaseController,
  verifyGooglePurchaseController,
  restorePurchasesController,
  getVerifiedStatusController,
  testGoogleConfigController,
};
