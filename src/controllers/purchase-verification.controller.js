import {
  verifyApplePurchase,
  verifyGooglePurchase,
  restorePurchases,
  getUserVerifiedStatus,
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
    const { receiptData, productId } = req.body;

    if (!receiptData) {
      return sendBadRequest(res, "Receipt data is required");
    }

    const result = await verifyApplePurchase(userId, receiptData, productId);

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

    if (!packageName || !productId || !purchaseToken) {
      return sendBadRequest(
        res,
        "Package name, product ID, and purchase token are required"
      );
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
    logger.error("Verify Google purchase controller error:", error);

    if (error.message.includes("duplicate") || error.message.includes("already")) {
      return sendBadRequest(res, error.message);
    }

    if (error.message.includes("Invalid") || error.message.includes("verification failed")) {
      return sendBadRequest(res, error.message);
    }

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

export default {
  verifyApplePurchaseController,
  verifyGooglePurchaseController,
  restorePurchasesController,
  getVerifiedStatusController,
};
