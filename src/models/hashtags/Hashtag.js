import mongoose from "mongoose";

const hashtagSchema = new mongoose.Schema(
  {
    tag: {
      type: String,
      lowercase: true,
      trim: true,
    },
    contentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
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
hashtagSchema.index({ contentCount: -1 }); // For trending hashtags
hashtagSchema.index({ lastUsedAt: -1 }); // For recent hashtags
// Note: tag field is automatically indexed by unique: true

const Hashtag = mongoose.model("Hashtag", hashtagSchema);

export default Hashtag;

