import mongoose from "mongoose";
import { ChatType, MessageType } from "../enums.js";

const chatRoomSchema = new mongoose.Schema(
  {
    userA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    chatType: {
      type: String,
      enum: Object.values(ChatType),
      default: ChatType.DIRECT,
    },
    /** When chatType is REQUEST: user who sent the request (the one not followed by the other) */
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    /** When chatType is REQUEST: status of the request (pending, rejected) */
    requestStatus: {
      type: String,
      enum: ["pending", "rejected"],
      default: "pending",
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    deletedBy: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    }],
    lastMessage: {
      type: String,
      default: null,
    },
    lastMessageType: {
      type: String,
      enum: Object.values(MessageType),
      default: null,
    },
    lastMessageAt: {
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

// Compound index to ensure unique chat rooms between two users
chatRoomSchema.index({ userA: 1, userB: 1 }, { unique: true });
chatRoomSchema.index({ userA: 1, lastMessageAt: -1 });
chatRoomSchema.index({ userB: 1, lastMessageAt: -1 });
chatRoomSchema.index({ chatType: 1 });

const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);

export default ChatRoom;
