/**
 * Chat Participant Model
 * Tracks read/unread status and last seen for each user in a chat room
 */

import mongoose from "mongoose";

const chatParticipantSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    lastReadMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatMessage",
      default: null,
    },
    lastReadAt: {
      type: Date,
      default: null,
    },
    unreadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true, // User is active in this chat
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

// Compound index to ensure one participant record per user per room
chatParticipantSchema.index({ roomId: 1, userId: 1 }, { unique: true });
chatParticipantSchema.index({ userId: 1, updatedAt: -1 });

const ChatParticipant = mongoose.model("ChatParticipant", chatParticipantSchema);

export default ChatParticipant;
