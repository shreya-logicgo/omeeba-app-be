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
    // Apple-specific fields
    originalTransactionId: {
      type: String,
      required: false,
    },
    latestTransactionId: {
      type: String,
      required: false,
    },
    productId: {
      type: String,
      required: false,
    },
    autoRenewStatus: {
      type: Boolean,
      default: true,
    },
    lastVerifiedAt: {
      type: Date,
      default: Date.now,
    },
    cancellationReason: {
      type: String,
      enum: ["USER_CANCELLED", "BILLING_ERROR", "PRICE_INCREASE", "REFUND", "REVOKED", "EXPIRED_INTENTIONALLY"],
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    // Store latest receipt data for verification
    latestReceiptData: {
      type: String,
      default: null,
    },
    // Subscription environment (sandbox/production)
    environment: {
      type: String,
      enum: ["sandbox", "production"],
      default: "production",
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
userSubscriptionSchema.index({ originalTransactionId: 1 });
userSubscriptionSchema.index({ latestTransactionId: 1 });
userSubscriptionSchema.index({ lastVerifiedAt: 1 });

const UserSubscription = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema
);

export default UserSubscription;
