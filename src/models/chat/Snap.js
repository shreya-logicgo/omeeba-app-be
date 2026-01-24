import mongoose from "mongoose";

const snapSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipients: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        viewedAt: {
          type: Date,
          default: null,
        },
        isViewed: {
          type: Boolean,
          default: false,
        },
        deliveredAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    mediaType: {
      type: String,
      enum: ["image", "video"],
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
      default: null, // Duration in seconds for videos
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isExpired: {
      type: Boolean,
      default: false,
      index: true,
    },
    viewCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
snapSchema.index({ senderId: 1, createdAt: -1 });
snapSchema.index({ "recipients.userId": 1, isExpired: 1, createdAt: -1 });
snapSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Method to mark snap as viewed by a recipient
snapSchema.methods.markAsViewed = function (userId) {
  const recipient = this.recipients.find(
    (r) => r.userId.toString() === userId.toString()
  );

  if (recipient && !recipient.isViewed) {
    recipient.isViewed = true;
    recipient.viewedAt = new Date();
    this.viewCount += 1;
    return true;
  }

  return false;
};

// Method to check if user is a recipient
snapSchema.methods.isRecipient = function (userId) {
  return this.recipients.some(
    (r) => r.userId.toString() === userId.toString()
  );
};

// Method to check if snap is expired
snapSchema.methods.checkExpiration = function () {
  if (!this.isExpired && this.expiresAt < new Date()) {
    this.isExpired = true;
    return true;
  }
  return false;
};

// Static method to get snaps for a user (inbox)
snapSchema.statics.getUserSnaps = function (userId, options = {}) {
  const { page = 1, limit = 20, includeExpired = false } = options;
  const skip = (page - 1) * limit;

  const query = {
    "recipients.userId": userId,
  };

  if (!includeExpired) {
    query.isExpired = false;
    query.expiresAt = { $gt: new Date() };
  }

  return this.find(query)
    .populate("senderId", "name username profileImage isVerifiedBadge")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get sent snaps for a user
snapSchema.statics.getSentSnaps = function (senderId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({ senderId })
    .populate("recipients.userId", "name username profileImage isVerifiedBadge")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

const Snap = mongoose.model("Snap", snapSchema);

export default Snap;
