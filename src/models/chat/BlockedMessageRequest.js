/**
 * Tracks when a user (recipient) blocks another user from sending message requests.
 * Block = remove request from list + prevent the blocked user from sending a new request.
 */

import mongoose from "mongoose";

const blockedMessageRequestSchema = new mongoose.Schema(
  {
    blockedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

blockedMessageRequestSchema.index(
  { blockedByUserId: 1, blockedUserId: 1 },
  { unique: true }
);
blockedMessageRequestSchema.index({ blockedByUserId: 1 });
blockedMessageRequestSchema.index({ blockedUserId: 1 });

const BlockedMessageRequest = mongoose.model(
  "BlockedMessageRequest",
  blockedMessageRequestSchema
);

export default BlockedMessageRequest;
