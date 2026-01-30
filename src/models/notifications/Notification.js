import mongoose from "mongoose";
import { NotificationType, NotificationStatus } from "../enums.js";

const notificationSchema = new mongoose.Schema(
  {
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    contentType: {
      type: String,
      default: null, // post / write_post / zeal / poll
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // related postId / commentId / pollId / etc.
    },
    message: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(NotificationStatus),
      default: NotificationStatus.UNREAD,
    },
    // Aggregation fields
    aggregationKey: {
      type: String,
      default: null, // Key to group similar notifications (e.g., "like:post:123")
      index: true,
    },
    isAggregated: {
      type: Boolean,
      default: false,
    },
    aggregatedCount: {
      type: Number,
      default: 0, // Number of similar notifications aggregated
    },
    aggregatedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ], // Array of user IDs who triggered the same action
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}, // Flexible metadata for additional info
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
notificationSchema.index({ receiverId: 1, status: 1, createdAt: -1 });
notificationSchema.index({ receiverId: 1, createdAt: -1 });
notificationSchema.index({ senderId: 1 });
notificationSchema.index({ aggregationKey: 1, receiverId: 1, createdAt: -1 }); // For aggregation queries
notificationSchema.index({ receiverId: 1, type: 1, contentId: 1 }); // For finding similar notifications

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
