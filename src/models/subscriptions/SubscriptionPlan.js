import mongoose from "mongoose";
import { BillingCycle } from "../enums.js";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      default: "USD",
      uppercase: true,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BillingCycle),
      required: true,
    },
    isVerifiedBadge: {
      type: Boolean,
      default: false,
    },
    prioritySupport: {
      type: Boolean,
      default: false,
    },
    adFreeExperience: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
subscriptionPlanSchema.index({ billingCycle: 1, isActive: 1 });
subscriptionPlanSchema.index({ isActive: 1 });

const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema
);

export default SubscriptionPlan;
