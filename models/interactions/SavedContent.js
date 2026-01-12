import mongoose from "mongoose";
import { ContentType } from "../enums.js";

const savedContentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    contentType: {
      type: String,
      enum: [...Object.values(ContentType), "poll"],
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
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

// Compound index to prevent duplicate saves
savedContentSchema.index(
  { userId: 1, contentType: 1, contentId: 1 },
  { unique: true }
);
savedContentSchema.index({ userId: 1, createdAt: -1 });
savedContentSchema.index({ contentType: 1, contentId: 1 });

const SavedContent = mongoose.model("SavedContent", savedContentSchema);

export default SavedContent;
