/**
 * Support Request Model
 * Tracks support requests and links them to chat rooms
 */

import mongoose from "mongoose";

const supportRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      unique: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "resolved", "closed"],
      default: "pending",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // Admin/support staff user ID
    },
    resolvedAt: {
      type: Date,
      default: null,
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
supportRequestSchema.index({ userId: 1, createdAt: -1 });
supportRequestSchema.index({ status: 1 });
supportRequestSchema.index({ priority: 1 });
supportRequestSchema.index({ assignedTo: 1 });
// Note: roomId already has an index from unique: true constraint, so no need for explicit index

const SupportRequest = mongoose.model("SupportRequest", supportRequestSchema);

export default SupportRequest;
