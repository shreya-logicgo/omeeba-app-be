import mongoose from "mongoose";

const chatBlockSchema = new mongoose.Schema(
  {
    blockerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    blockedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure unique block relationships and prevent duplicates
chatBlockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

// Indexes for efficient queries
chatBlockSchema.index({ blockerId: 1, blockedAt: -1 });
chatBlockSchema.index({ blockedUserId: 1, blockedAt: -1 });

// Static method to check if user is blocked
chatBlockSchema.statics.isBlocked = async function (userId, otherUserId) {
  const block = await this.findOne({
    $or: [
      { blockerId: userId, blockedUserId: otherUserId },
      { blockerId: otherUserId, blockedUserId: userId },
    ],
  });
  
  if (block) {
    return {
      isBlocked: true,
      blockedBy: block.blockerId.toString() === userId ? "me" : "other",
      blockedAt: block.blockedAt,
    };
  }
  
  return { isBlocked: false };
};

// Static method to block a user
chatBlockSchema.statics.blockUser = async function (blockerId, blockedUserId) {
  try {
    const existingBlock = await this.findOne({
      blockerId,
      blockedUserId,
    });
    
    if (existingBlock) {
      throw new Error("User is already blocked");
    }
    
    const block = await this.create({
      blockerId,
      blockedUserId,
    });
    
    return block;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error("User is already blocked");
    }
    throw error;
  }
};

// Static method to unblock a user
chatBlockSchema.statics.unblockUser = async function (blockerId, blockedUserId) {
  const result = await this.deleteOne({
    blockerId,
    blockedUserId,
  });
  
  if (result.deletedCount === 0) {
    throw new Error("No block found to remove");
  }
  
  return true;
};

// Static method to get blocked users list
chatBlockSchema.statics.getBlockedUsers = async function (blockerId, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const blocks = await this.find({ blockerId })
    .populate("blockedUserId", "name username profileImage isVerifiedBadge")
    .sort({ blockedAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await this.countDocuments({ blockerId });

  return {
    blockedUsers: blocks.map((block) => ({
      id: block._id.toString(),
      blockedUser: {
        id: block.blockedUserId._id.toString(),
        name: block.blockedUserId.name,
        username: block.blockedUserId.username,
        profileImage: block.blockedUserId.profileImage,
        isVerifiedBadge: block.blockedUserId.isVerifiedBadge,
      },
      blockedAt: block.blockedAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

const ChatBlock = mongoose.model("ChatBlock", chatBlockSchema);

export default ChatBlock;
