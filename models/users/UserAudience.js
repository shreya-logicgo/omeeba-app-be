import mongoose from "mongoose";

const userAudienceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    audienceUserId: {
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

// Compound index to prevent duplicates
userAudienceSchema.index({ userId: 1, audienceUserId: 1 }, { unique: true });
userAudienceSchema.index({ userId: 1 });
userAudienceSchema.index({ audienceUserId: 1 });

const UserAudience = mongoose.model("UserAudience", userAudienceSchema);

export default UserAudience;

