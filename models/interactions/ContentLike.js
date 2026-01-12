import mongoose from "mongoose";
import {
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
} from "../enums.js";

const contentLikeSchema = new mongoose.Schema(
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
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Compound index to prevent duplicate likes
contentLikeSchema.index(
  { contentType: 1, contentId: 1, userId: 1 },
  { unique: true }
);
contentLikeSchema.index({ contentType: 1, contentId: 1 });
contentLikeSchema.index({ userId: 1 });

// Pre-save hook to set contentTypeRef based on contentType
contentLikeSchema.pre("save", function (next) {
  if (this.contentType && !this.contentTypeRef) {
    this.contentTypeRef = ContentTypeToModelName[this.contentType];
  }
  next();
});

const ContentLike = mongoose.model("ContentLike", contentLikeSchema);

export default ContentLike;
