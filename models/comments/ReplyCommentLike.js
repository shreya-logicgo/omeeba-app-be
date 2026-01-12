import mongoose from "mongoose";

const replyCommentLikeSchema = new mongoose.Schema(
  {
    replyCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReplyComment",
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
replyCommentLikeSchema.index({ replyCommentId: 1, userId: 1 }, { unique: true });
replyCommentLikeSchema.index({ replyCommentId: 1 });
replyCommentLikeSchema.index({ userId: 1 });

const ReplyCommentLike = mongoose.model("ReplyCommentLike", replyCommentLikeSchema);

export default ReplyCommentLike;

