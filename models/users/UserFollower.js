import mongoose from "mongoose";

const userFollowerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    followerId: {
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

// Compound index to prevent duplicate follows
userFollowerSchema.index({ userId: 1, followerId: 1 }, { unique: true });
userFollowerSchema.index({ userId: 1 });
userFollowerSchema.index({ followerId: 1 });

const UserFollower = mongoose.model("UserFollower", userFollowerSchema);

export default UserFollower;
