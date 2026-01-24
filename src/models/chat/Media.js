import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    storageKey: {
      type: String,
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    duration: {
      type: Number,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

mediaSchema.index({ userId: 1, createdAt: -1 });

const Media = mongoose.model("Media", mediaSchema);
export default Media;
