import mongoose from "mongoose";
import { SubscriptionStatus } from "../enums.js";

const userSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      default: SubscriptionStatus.PENDING,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSubscriptionSchema.index({ userId: 1, status: 1 });
userSubscriptionSchema.index({ status: 1, endDate: 1 });
userSubscriptionSchema.index({ endDate: 1 });

const UserSubscription = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema
);

export default UserSubscription;
