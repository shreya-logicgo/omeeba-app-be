import { triggerSubscriptionVerification } from "../services/apple-subscription-cron.service.js";
import UserSubscription from "../models/subscriptions/UserSubscription.js";
import { SubscriptionStatus } from "../models/enums.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Manually trigger Apple subscription verification
 * This endpoint is for testing and manual verification
 */
export const triggerVerification = async (req, res) => {
  try {
    logger.info("Manual Apple subscription verification triggered by admin");
    
    const results = await triggerSubscriptionVerification();
    
    return sendSuccess(
      res,
      {
        message: "Verification completed",
        results: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length,
          details: results
        }
      },
      "Apple subscription verification completed",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error in manual Apple subscription verification:", error);
    return sendError(
      res,
      "Verification failed",
      "Subscription Verification Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get all Apple subscriptions with their current status
 */
export const getAppleSubscriptions = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    
    // Build filter
    const filter = {
      originalTransactionId: { $exists: true, $ne: null }
    };
    
    if (status) {
      filter.status = status;
    }

    // Get subscriptions with pagination
    const subscriptions = await UserSubscription.find(filter)
      .populate('userId', 'username email')
      .populate('planId', 'name billingCycle price')
      .sort({ lastVerifiedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await UserSubscription.countDocuments(filter);

    return sendSuccess(
      res,
      {
        subscriptions,
        pagination: {
          current: page,
          pageSize: limit,
          total,
          pages: Math.ceil(total / limit)
        }
      },
      "Apple subscriptions retrieved successfully",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error getting Apple subscriptions:", error);
    return sendError(
      res,
      "Failed to retrieve subscriptions",
      "Subscription Retrieval Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get subscription details by original transaction ID
 */
export const getSubscriptionByTransactionId = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const subscription = await UserSubscription.findOne({
      originalTransactionId: transactionId
    })
      .populate('userId', 'username email')
      .populate('planId', 'name billingCycle price');

    if (!subscription) {
      return sendError(
        res,
        "Subscription not found",
        "Not Found",
        null,
        StatusCodes.NOT_FOUND
      );
    }

    return sendSuccess(
      res,
      { subscription },
      "Subscription details retrieved successfully",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error getting subscription details:", error);
    return sendError(
      res,
      "Failed to retrieve subscription",
      "Subscription Retrieval Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get subscription statistics
 */
export const getSubscriptionStats = async (req, res) => {
  try {
    const stats = await UserSubscription.aggregate([
      {
        $match: {
          originalTransactionId: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalSubscriptions = await UserSubscription.countDocuments({
      originalTransactionId: { $exists: true, $ne: null }
    });

    const activeSubscriptions = await UserSubscription.countDocuments({
      originalTransactionId: { $exists: true, $ne: null },
      status: SubscriptionStatus.ACTIVE
    });

    const expiredSubscriptions = await UserSubscription.countDocuments({
      originalTransactionId: { $exists: true, $ne: null },
      status: SubscriptionStatus.EXPIRED
    });

    const cancelledSubscriptions = await UserSubscription.countDocuments({
      originalTransactionId: { $exists: true, $ne: null },
      status: SubscriptionStatus.CANCELLED
    });

    // Get subscriptions expiring in next 7 days
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = await UserSubscription.countDocuments({
      originalTransactionId: { $exists: true, $ne: null },
      status: SubscriptionStatus.ACTIVE,
      expiresAt: { $lte: sevenDaysFromNow, $gt: new Date() }
    });

    return sendSuccess(
      res,
      {
        total: totalSubscriptions,
        active: activeSubscriptions,
        expired: expiredSubscriptions,
        cancelled: cancelledSubscriptions,
        expiringSoon,
        breakdown: stats,
        renewalRate: totalSubscriptions > 0 ? ((activeSubscriptions / totalSubscriptions) * 100).toFixed(2) : 0
      },
      "Subscription statistics retrieved successfully",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error getting subscription statistics:", error);
    return sendError(
      res,
      "Failed to retrieve statistics",
      "Statistics Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Force verify a specific subscription
 */
export const verifySpecificSubscription = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const subscription = await UserSubscription.findOne({
      originalTransactionId: transactionId
    });

    if (!subscription) {
      return sendError(
        res,
        "Subscription not found",
        "Not Found",
        null,
        StatusCodes.NOT_FOUND
      );
    }

    // Import the verification function
    const { verifySubscriptionStatus } = await import("../services/apple-subscription.service.js");
    
    const updatedSubscription = await verifySubscriptionStatus(subscription);

    return sendSuccess(
      res,
      {
        subscription: updatedSubscription,
        message: "Subscription verification completed"
      },
      "Specific subscription verified successfully",
      StatusCodes.OK
    );

  } catch (error) {
    logger.error("Error verifying specific subscription:", error);
    return sendError(
      res,
      "Verification failed",
      "Subscription Verification Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};
