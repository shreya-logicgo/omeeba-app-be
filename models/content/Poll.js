import mongoose from "mongoose";
import { PollStatus } from "../enums.js";

const pollOptionSchema = new mongoose.Schema(
  {
    optionId: {
      type: String,
      required: true,
    },
    optionText: {
      type: String,
      required: true,
    },
    voteCount: {
      type: Number,
      default: 0,
    },
    votePercentage: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const userVoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    optionId: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const pollSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    caption: {
      type: String,
      default: "",
    },
    options: [pollOptionSchema],
    totalVotes: {
      type: Number,
      default: 0,
    },
    userVotes: [userVoteSchema],
    status: {
      type: String,
      enum: Object.values(PollStatus),
      default: PollStatus.ACTIVE,
    },
    duration: {
      type: Date,
      required: true,
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
pollSchema.index({ createdBy: 1, createdAt: -1 });
pollSchema.index({ status: 1, duration: 1 });
pollSchema.index({ createdAt: -1 });

const Poll = mongoose.model("Poll", pollSchema);

export default Poll;
