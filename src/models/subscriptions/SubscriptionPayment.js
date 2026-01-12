import mongoose from "mongoose";
import { SubscriptionStatus } from "../enums.js";

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserSubscription",
      required: true,
    },
    amount: {
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
    paymentProvider: {
      type: String,
      required: true,
      enum: ["stripe", "razorpay", "apple", "google"],
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes
subscriptionPaymentSchema.index({ userId: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ subscriptionId: 1 });
subscriptionPaymentSchema.index({ transactionId: 1 });
subscriptionPaymentSchema.index({ status: 1 });

const SubscriptionPayment = mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema
);

export default SubscriptionPayment;
