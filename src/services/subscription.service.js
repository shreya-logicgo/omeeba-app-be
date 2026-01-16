import SubscriptionPlan from "../models/subscriptions/SubscriptionPlan.js";
import UserSubscription from "../models/subscriptions/UserSubscription.js";
import SubscriptionPayment from "../models/subscriptions/SubscriptionPayment.js";
import User from "../models/users/User.js";
import {
  createRazorpayOrder,
  createStripePaymentIntent,
  getPaymentProvider,
} from "./payment.service.js";
import { SubscriptionStatus } from "../models/enums.js";
import { PAYMENT_PROVIDERS, PAYMENT_STATUS } from "../constants/index.js";
import { BillingCycle } from "../models/enums.js";
import {
  getAllPlansWithCalculations,
  calculatePerDayPrice,
  calculatePerMonthPrice,
  getDaysInBillingCycle,
} from "../constants/subscriptionPlans.js";
import { sendSubscriptionExpiryEmail } from "./email.service.js";
import logger from "../utils/logger.js";

/**
 * Get Active Subscription Plans (from static configuration)
 * @returns {Promise<Array>} List of active subscription plans with calculated prices
 */
export const getActivePlans = async () => {
  try {
    // Get plans from static configuration (primary source)
    const staticPlans = getAllPlansWithCalculations();

    // Check database for plan IDs (if plans are seeded)
    const dbPlans = await SubscriptionPlan.find({ isActive: true }).sort({
      price: 1,
    });

    // Map static plans with database IDs if available
    const allPlans = staticPlans.map((staticPlan) => {
      // Find matching plan in database by billing cycle
      const dbPlan = dbPlans.find(
        (plan) => plan.billingCycle === staticPlan.billingCycle
      );

      return {
        ...staticPlan,
        id: dbPlan?._id?.toString() || null,
        _id: dbPlan?._id || null,
        isActive: true,
      };
    });

    return allPlans;
  } catch (error) {
    logger.error("Error getting active plans:", error);
    throw error;
  }
};

/**
 * Get Subscription Plan by ID or Billing Cycle
 * @param {string} planIdOrBillingCycle - Plan ID or Billing Cycle (Monthly, Quarterly, Yearly)
 * @returns {Promise<Object>} Subscription plan with calculated prices
 */
export const getPlanById = async (planIdOrBillingCycle) => {
  try {
    // First, try to get from static configuration by billing cycle
    const { getAllPlansWithCalculations, getPlanByBillingCycle } =
      await import("../constants/subscriptionPlans.js");
    const staticPlan = getPlanByBillingCycle(planIdOrBillingCycle);

    if (staticPlan) {
      // Return static plan with calculations
      const plansWithCalc = getAllPlansWithCalculations();
      const planWithCalc = plansWithCalc.find(
        (p) => p.billingCycle === planIdOrBillingCycle
      );

      // Try to find in database to get the ID
      const dbPlan = await SubscriptionPlan.findOne({
        billingCycle: planIdOrBillingCycle,
        isActive: true,
      });

      return {
        ...planWithCalc,
        _id: dbPlan?._id || null,
        id: dbPlan?._id?.toString() || null,
      };
    }

    // If not found in static plans, try database by ID
    const dbPlan = await SubscriptionPlan.findById(planIdOrBillingCycle);

    if (!dbPlan) {
      throw new Error("Subscription plan not found");
    }

    if (!dbPlan.isActive) {
      throw new Error("Subscription plan is not active");
    }

    // Add calculated prices to database plan
    const perDayPrice = calculatePerDayPrice(dbPlan.price, dbPlan.billingCycle);
    const perMonthPrice = calculatePerMonthPrice(
      dbPlan.price,
      dbPlan.billingCycle
    );
    const days = getDaysInBillingCycle(dbPlan.billingCycle);

    return {
      ...dbPlan.toObject(),
      perDayPrice,
      perMonthPrice,
      durationInDays: days,
      durationInMonths: Math.round((days / 30) * 100) / 100,
    };
  } catch (error) {
    logger.error("Error getting plan by ID:", error);
    throw error;
  }
};

/**
 * Calculate Subscription End Date
 * @param {Date} startDate - Start date
 * @param {string} billingCycle - Billing cycle (Monthly, Quarterly, Yearly)
 * @returns {Date} End date
 */
export const calculateEndDate = (startDate, billingCycle) => {
  const endDate = new Date(startDate);

  switch (billingCycle) {
    case BillingCycle.MONTHLY:
      endDate.setMonth(endDate.getMonth() + 1);
      break;
    case BillingCycle.QUARTERLY:
      endDate.setMonth(endDate.getMonth() + 3);
      break;
    case BillingCycle.YEARLY:
      endDate.setFullYear(endDate.getFullYear() + 1);
      break;
    default:
      endDate.setMonth(endDate.getMonth() + 1);
  }

  return endDate;
};

/**
 * Create Subscription and Payment Order
 * @param {string} userId - User ID
 * @param {string} planId - Plan ID
 * @returns {Promise<Object>} Subscription and payment order details
 */
export const createSubscription = async (userId, planId) => {
  try {
    // Verify user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Get plan (can be plan ID or billing cycle)
    const plan = await getPlanById(planId);

    // Ensure plan has calculated prices
    if (!plan.perDayPrice) {
      plan.perDayPrice = calculatePerDayPrice(plan.price, plan.billingCycle);
      plan.perMonthPrice = calculatePerMonthPrice(
        plan.price,
        plan.billingCycle
      );
      plan.durationInDays = getDaysInBillingCycle(plan.billingCycle);
      plan.durationInMonths =
        Math.round((plan.durationInDays / 30) * 100) / 100;
    }

    // Check if user already has an active subscription
    const existingSubscription = await UserSubscription.findOne({
      userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gt: new Date() },
    });

    if (existingSubscription) {
      throw new Error("You already have an active subscription");
    }

    // Create subscription with pending status
    const startDate = new Date();
    const endDate = calculateEndDate(startDate, plan.billingCycle);

    const subscription = new UserSubscription({
      userId,
      planId: plan._id,
      status: SubscriptionStatus.PENDING,
      startDate,
      endDate,
    });

    await subscription.save();

    // Determine payment provider based on currency
    const paymentProvider = getPaymentProvider(plan.currency);
    let paymentOrder = null;

    if (paymentProvider === PAYMENT_PROVIDERS.RAZORPAY) {
      // Create Razorpay order
      const razorpayOrder = await createRazorpayOrder(
        plan.price,
        plan.currency,
        {
          receipt: `sub_${subscription._id}`,
          notes: {
            userId: userId.toString(),
            subscriptionId: subscription._id.toString(),
            planId: plan._id.toString(),
          },
        }
      );

      paymentOrder = {
        provider: PAYMENT_PROVIDERS.RAZORPAY,
        orderId: razorpayOrder.orderId,
        amount: razorpayOrder.amount / 100, // Convert from paise
        currency: razorpayOrder.currency,
      };
    } else if (paymentProvider === PAYMENT_PROVIDERS.STRIPE) {
      // Create Stripe payment intent
      const stripePayment = await createStripePaymentIntent(
        plan.price,
        plan.currency,
        {
          metadata: {
            userId: userId.toString(),
            subscriptionId: subscription._id.toString(),
            planId: plan._id.toString(),
          },
        }
      );

      paymentOrder = {
        provider: PAYMENT_PROVIDERS.STRIPE,
        clientSecret: stripePayment.clientSecret,
        paymentIntentId: stripePayment.paymentIntentId,
        amount: stripePayment.amount,
        currency: stripePayment.currency,
      };
    }

    logger.info(
      `Subscription created: ${subscription._id} for user: ${userId}`
    );

    return {
      subscription: {
        id: subscription._id,
        planId: plan._id,
        planName: plan.name,
        amount: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        status: subscription.status,
      },
      payment: paymentOrder,
    };
  } catch (error) {
    logger.error("Error creating subscription:", error);
    throw error;
  }
};

/**
 * Process Payment Success
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} paymentData - Payment data from gateway
 * @returns {Promise<Object>} Updated subscription and payment
 */
export const processPaymentSuccess = async (subscriptionId, paymentData) => {
  try {
    const subscription =
      await UserSubscription.findById(subscriptionId).populate("planId");

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Check if payment already exists
    let payment = await SubscriptionPayment.findOne({
      transactionId: paymentData.transactionId,
    });

    if (payment) {
      logger.warn(`Payment already exists: ${paymentData.transactionId}`);
      return { subscription, payment };
    }

    // Create payment record
    payment = new SubscriptionPayment({
      userId: subscription.userId,
      subscriptionId: subscription._id,
      amount: paymentData.amount,
      currency: paymentData.currency || subscription.planId.currency,
      paymentProvider: paymentData.provider,
      transactionId: paymentData.transactionId,
      status: paymentData.status || PAYMENT_STATUS.SUCCESS,
    });

    await payment.save();

    // Update subscription status to ACTIVE
    subscription.status = SubscriptionStatus.ACTIVE;
    // Ensure startDate and endDate are set (they should already be set during creation)
    if (!subscription.startDate) {
      subscription.startDate = new Date();
    }
    if (!subscription.endDate) {
      // Recalculate end date if not set
      subscription.endDate = calculateEndDate(
        subscription.startDate,
        subscription.planId.billingCycle
      );
    }
    await subscription.save();

    // Update user verified badge if plan includes it
    if (subscription.planId.isVerifiedBadge) {
      const user = await User.findById(subscription.userId);
      if (user) {
        user.isVerifiedBadge = true;
        await user.save();
        logger.info(`Verified badge activated for user: ${user._id}`);
      }
    }

    logger.info(
      `Payment processed successfully: ${payment._id} for subscription: ${subscriptionId}`
    );

    return { subscription, payment };
  } catch (error) {
    logger.error("Error processing payment success:", error);
    throw error;
  }
};

/**
 * Process Payment Failure
 * @param {string} subscriptionId - Subscription ID
 * @param {Object} paymentData - Payment data from gateway
 * @returns {Promise<Object>} Updated subscription and payment
 */
export const processPaymentFailure = async (subscriptionId, paymentData) => {
  try {
    const subscription = await UserSubscription.findById(subscriptionId);

    if (!subscription) {
      throw new Error("Subscription not found");
    }

    // Create payment record with failed status
    const payment = new SubscriptionPayment({
      userId: subscription.userId,
      subscriptionId: subscription._id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      paymentProvider: paymentData.provider,
      transactionId: paymentData.transactionId,
      status: PAYMENT_STATUS.FAILED,
    });

    await payment.save();

    // Update subscription status to cancelled
    subscription.status = SubscriptionStatus.CANCELLED;
    await subscription.save();

    logger.info(
      `Payment failed: ${payment._id} for subscription: ${subscriptionId}`
    );

    return { subscription, payment };
  } catch (error) {
    logger.error("Error processing payment failure:", error);
    throw error;
  }
};

/**
 * Get User Active Subscription
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Active subscription or null
 */
export const getUserActiveSubscription = async (userId) => {
  try {
    const subscription = await UserSubscription.findOne({
      userId,
      status: SubscriptionStatus.ACTIVE,
      endDate: { $gt: new Date() },
    })
      .populate("planId")
      .sort({ createdAt: -1 });

    return subscription;
  } catch (error) {
    logger.error("Error getting user active subscription:", error);
    throw error;
  }
};

/**
 * Get User Payment History
 * @param {string} userId - User ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Payment history with pagination
 */
export const getUserPaymentHistory = async (userId, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const payments = await SubscriptionPayment.find({ userId })
      .populate("subscriptionId", "planId startDate endDate status")
      .populate({
        path: "subscriptionId",
        populate: {
          path: "planId",
          select: "name price currency billingCycle",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await SubscriptionPayment.countDocuments({ userId });

    return {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    logger.error("Error getting payment history:", error);
    throw error;
  }
};

/**
 * Check and process expired subscriptions
 * @returns {Promise<Object>} Processing result
 */
export const processExpiredSubscriptions = async () => {
  try {
    const now = new Date();

    // Find all active subscriptions that have expired
    const expiredSubscriptions = await UserSubscription.find({
      status: SubscriptionStatus.ACTIVE,
      endDate: { $lte: now },
    }).populate("userId", "email name isVerifiedBadge");

    if (expiredSubscriptions.length === 0) {
      logger.info("No expired subscriptions found");
      return {
        processed: 0,
        expired: [],
      };
    }

    const processed = [];
    const errors = [];

    for (const subscription of expiredSubscriptions) {
      try {
        // Update subscription status to EXPIRED
        subscription.status = SubscriptionStatus.EXPIRED;
        await subscription.save();

        // Disable verified badge if user has it
        if (subscription.userId && subscription.userId.isVerifiedBadge) {
          const user = await User.findById(subscription.userId._id);
          if (user) {
            user.isVerifiedBadge = false;
            await user.save();
            logger.info(`Verified badge disabled for user: ${user._id}`);
          }
        }

        // Send expiry notification email
        if (subscription.userId?.email) {
          try {
            await sendSubscriptionExpiryEmail(
              subscription.userId.email,
              subscription.userId.name,
              subscription.endDate
            );
            logger.info(`Expiry email sent to: ${subscription.userId.email}`);
          } catch (emailError) {
            logger.error(
              `Failed to send expiry email to ${subscription.userId.email}:`,
              emailError
            );
          }
        }

        processed.push({
          subscriptionId: subscription._id,
          userId: subscription.userId?._id,
          email: subscription.userId?.email,
        });
      } catch (error) {
        logger.error(
          `Error processing expired subscription ${subscription._id}:`,
          error
        );
        errors.push({
          subscriptionId: subscription._id,
          error: error.message,
        });
      }
    }

    logger.info(
      `Processed ${processed.length} expired subscriptions. Errors: ${errors.length}`
    );

    return {
      processed: processed.length,
      expired: processed,
      errors,
    };
  } catch (error) {
    logger.error("Error processing expired subscriptions:", error);
    throw error;
  }
};

export default {
  getActivePlans,
  getPlanById,
  createSubscription,
  processPaymentSuccess,
  processPaymentFailure,
  getUserActiveSubscription,
  getUserPaymentHistory,
  processExpiredSubscriptions,
  calculateEndDate,
};
