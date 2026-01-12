import mongoose from "mongoose";

const writePostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      default: "",
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
    musicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Music",
      default: null,
    },
    musicStartTime: {
      type: Number,
      default: null, // in seconds
    },
    musicEndTime: {
      type: Number,
      default: null, // in seconds
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
writePostSchema.index({ userId: 1, createdAt: -1 });
writePostSchema.index({ createdAt: -1 });
writePostSchema.index({ mentionedUserIds: 1 });

const WritePost = mongoose.model("WritePost", writePostSchema);

export default WritePost;

