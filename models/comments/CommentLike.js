import mongoose from "mongoose";

const commentLikeSchema = new mongoose.Schema(
  {
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
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
commentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });
commentLikeSchema.index({ commentId: 1 });
commentLikeSchema.index({ userId: 1 });

const CommentLike = mongoose.model("CommentLike", commentLikeSchema);

export default CommentLike;

