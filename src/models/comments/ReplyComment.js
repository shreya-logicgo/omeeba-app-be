import mongoose from "mongoose";

const replyCommentSchema = new mongoose.Schema(
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
    reply: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    mentionedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
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
replyCommentSchema.index({ commentId: 1, createdAt: -1 });
replyCommentSchema.index({ userId: 1 });

const ReplyComment = mongoose.model("ReplyComment", replyCommentSchema);

export default ReplyComment;

