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
      default: null, // post / write_post / zeal / photo
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // related postId / commentId / etc.
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

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
