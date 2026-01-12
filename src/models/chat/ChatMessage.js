import mongoose from "mongoose";
import {
  MessageType,
  MessageStatus,
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
} from "../enums.js";

const chatMessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    messageType: {
      type: String,
      enum: Object.values(MessageType),
      required: true,
    },
    message: {
      type: String,
      default: null, // text message
    },
    mediaUrl: {
      type: String,
      default: null, // image / snap url
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null, // postId / writePostId / zealId (when shared)
      refPath: "contentTypeRef",
    },
    contentType: {
      type: String,
      enum: [MessageType.POST, MessageType.WRITE_POST, MessageType.ZEAL],
      default: null, // post / write_post / zeal
    },
    contentTypeRef: {
      type: String,
      enum: Object.values(ContentModelName),
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.SENT,
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
chatMessageSchema.index({ roomId: 1, createdAt: -1 });
chatMessageSchema.index({ senderId: 1 });
chatMessageSchema.index({ status: 1 });

// Pre-save hook to set contentTypeRef based on contentType
chatMessageSchema.pre("save", function (next) {
  if (this.contentType && this.contentId && !this.contentTypeRef) {
    // Map MessageType to ContentType for model name lookup
    const messageTypeToContentType = {
      [MessageType.POST]: ContentType.POST,
      [MessageType.WRITE_POST]: ContentType.WRITE_POST,
      [MessageType.ZEAL]: ContentType.ZEAL,
    };
    const contentType = messageTypeToContentType[this.contentType];
    if (contentType) {
      this.contentTypeRef = ContentTypeToModelName[contentType];
    }
  }
  next();
});

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);

export default ChatMessage;
