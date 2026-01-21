import mongoose from "mongoose";

const writePostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    mentionedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    shareCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
writePostSchema.index({ userId: 1, createdAt: -1 });
writePostSchema.index({ createdAt: -1 });
writePostSchema.index({ mentionedUserIds: 1 });
writePostSchema.index({ shareCount: -1 }); // For analytics and virality tracking

const WritePost = mongoose.model("WritePost", writePostSchema);

export default WritePost;
