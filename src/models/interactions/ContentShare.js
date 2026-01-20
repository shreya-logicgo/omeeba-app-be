import mongoose from "mongoose";
import {
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
} from "../enums.js";

const contentShareSchema = new mongoose.Schema(
  {
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "contentTypeRef",
    },
    contentTypeRef: {
      type: String,
      enum: Object.values(ContentModelName),
      required: false,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
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
contentShareSchema.index({ senderId: 1, createdAt: -1 });
contentShareSchema.index({ receiverIds: 1, createdAt: -1 });
contentShareSchema.index({ contentType: 1, contentId: 1 });
contentShareSchema.index({ contentType: 1, contentId: 1, senderId: 1 });

// Pre-save hook to set contentTypeRef based on contentType
contentShareSchema.pre("save", function (next) {
  if (this.contentType && !this.contentTypeRef) {
    this.contentTypeRef = ContentTypeToModelName[this.contentType];
  }
  next();
});

const ContentShare = mongoose.model("ContentShare", contentShareSchema);

export default ContentShare;
