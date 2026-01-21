import mongoose from "mongoose";
import { SubscriptionStatus } from "../enums.js";
import { PAYMENT_PROVIDERS } from "../../constants/index.js";

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
      enum: Object.values(PAYMENT_PROVIDERS),
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
    // Store platform-specific data
    receiptData: {
      type: String, // For Apple: base64 receipt, For Google: purchase token
      default: null,
    },
    productId: {
      type: String, // Product ID/SKU from the store
      default: null,
    },
    packageName: {
      type: String, // For Google Play: package name
      default: null,
    },
    orderId: {
      type: String, // For Google Play: order ID
      default: null,
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
// Note: transactionId index is automatically created by unique: true
subscriptionPaymentSchema.index({ userId: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ subscriptionId: 1 });
subscriptionPaymentSchema.index({ status: 1 });

const SubscriptionPayment = mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema
);

export default SubscriptionPayment;
