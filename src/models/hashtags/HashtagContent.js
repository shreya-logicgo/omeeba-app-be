import mongoose from "mongoose";
import { ContentType } from "../enums.js";

const hashtagContentSchema = new mongoose.Schema(
  {
    hashtagId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hashtag",
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: [...Object.values(ContentType), "Poll"],
      required: true,
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
hashtagContentSchema.index({ hashtagId: 1, contentType: 1 });
hashtagContentSchema.index({ contentType: 1, contentId: 1 });
hashtagContentSchema.index({ hashtagId: 1, contentId: 1 });
// Unique constraint: one hashtag can be linked to a content only once
hashtagContentSchema.index({ hashtagId: 1, contentType: 1, contentId: 1 }, { unique: true });

const HashtagContent = mongoose.model("HashtagContent", hashtagContentSchema);

export default HashtagContent;

