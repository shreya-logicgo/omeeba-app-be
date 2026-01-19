import mongoose from "mongoose";
import { ZealStatus } from "../enums.js";

const zealPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    videos: [
      {
        type: String,
      },
    ],
    images: [
      {
        type: String,
      },
    ],
    musicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Music",
      default: null,
    },
    musicStartTime: {
      type: Number,
      default: null, // in seconds
    },
    musicEndTime: {
      type: Number,
      default: null, // in seconds
    },
    caption: {
      type: String,
      default: "",
    },
    mentionedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDevelopByAi: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: Object.values(ZealStatus),
      default: ZealStatus.DRAFT,
      required: true,
    },
    processingError: {
      type: String,
      default: null,
    },
    mediaUrl: {
      type: String,
      default: null,
    },
    thumbnailUrl: {
      type: String,
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
zealPostSchema.index({ userId: 1, createdAt: -1 });
zealPostSchema.index({ createdAt: -1 });
zealPostSchema.index({ mentionedUserIds: 1 });
zealPostSchema.index({ status: 1 });
zealPostSchema.index({ userId: 1, status: 1 });

const ZealPost = mongoose.model("ZealPost", zealPostSchema);

export default ZealPost;

