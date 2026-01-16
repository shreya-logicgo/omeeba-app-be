import { BillingCycle } from "../models/enums.js";

// Currency codes (defined here to avoid circular dependency)
const CURRENCY = {
  USD: "USD",
  INR: "INR",
  EUR: "EUR",
  GBP: "GBP",
};

/**
 * Static Subscription Plan Configuration
 * These are the predefined subscription plans for verified badge
 */
export const SUBSCRIPTION_PLANS = {
  // Monthly Plan
  MONTHLY: {
    name: "Monthly Verified Badge",
    price: 9.99,
    currency: CURRENCY.USD,
    billingCycle: BillingCycle.MONTHLY,
    isVerifiedBadge: true,
    prioritySupport: true,
    adFreeExperience: true,
    description: "Get verified badge for 1 month",
  },

  // Quarterly Plan (3 months)
  QUARTERLY: {
    name: "Quarterly Verified Badge",
    price: 24.99,
    currency: CURRENCY.USD,
    billingCycle: BillingCycle.QUARTERLY,
    isVerifiedBadge: true,
    prioritySupport: true,
    adFreeExperience: true,
    description: "Get verified badge for 3 months (Save 17%)",
  },

  // Yearly Plan (12 months)
  YEARLY: {
    name: "Yearly Verified Badge",
    price: 79.99,
    currency: CURRENCY.USD,
    billingCycle: BillingCycle.YEARLY,
    isVerifiedBadge: true,
    prioritySupport: true,
    adFreeExperience: true,
    description: "Get verified badge for 12 months (Save 33%)",
  },
};

/**
 * Calculate days in billing cycle
 * @param {string} billingCycle - Billing cycle (Monthly, Quarterly, Yearly)
 * @returns {number} Number of days
 */
export const getDaysInBillingCycle = (billingCycle) => {
  const daysMap = {
    [BillingCycle.MONTHLY]: 30, // Average month
    [BillingCycle.QUARTERLY]: 90, // 3 months
    [BillingCycle.YEARLY]: 365, // 1 year
  };
  return daysMap[billingCycle] || 30;
};

/**
 * Calculate per day price
 * @param {number} price - Total price
 * @param {string} billingCycle - Billing cycle
 * @returns {number} Price per day (rounded to 2 decimal places)
 */
export const calculatePerDayPrice = (price, billingCycle) => {
  const days = getDaysInBillingCycle(billingCycle);
  return Math.round((price / days) * 100) / 100;
};

/**
 * Calculate per month price (equivalent monthly price)
 * @param {number} price - Total price
 * @param {string} billingCycle - Billing cycle
 * @returns {number} Price per month (rounded to 2 decimal places)
 */
export const calculatePerMonthPrice = (price, billingCycle) => {
  const days = getDaysInBillingCycle(billingCycle);
  const months = days / 30; // Average month = 30 days
  return Math.round((price / months) * 100) / 100;
};

/**
 * Get all subscription plans with calculated prices
 * @returns {Array} Array of plans with calculated prices
 */
export const getAllPlansWithCalculations = () => {
  return Object.values(SUBSCRIPTION_PLANS).map((plan) => {
    const perDayPrice = calculatePerDayPrice(plan.price, plan.billingCycle);
    const perMonthPrice = calculatePerMonthPrice(plan.price, plan.billingCycle);
    const days = getDaysInBillingCycle(plan.billingCycle);

    return {
      ...plan,
      perDayPrice,
      perMonthPrice,
      durationInDays: days,
      durationInMonths: Math.round((days / 30) * 100) / 100,
    };
  });
};

/**
 * Get plan by billing cycle
 * @param {string} billingCycle - Billing cycle
 * @returns {Object|null} Plan object or null
 */
export const getPlanByBillingCycle = (billingCycle) => {
  const planKey = Object.keys(SUBSCRIPTION_PLANS).find(
    (key) => SUBSCRIPTION_PLANS[key].billingCycle === billingCycle
  );
  return planKey ? SUBSCRIPTION_PLANS[planKey] : null;
};

export default {
  SUBSCRIPTION_PLANS,
  getDaysInBillingCycle,
  calculatePerDayPrice,
  calculatePerMonthPrice,
  getAllPlansWithCalculations,
  getPlanByBillingCycle,
};
