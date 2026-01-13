import WritePost from "../models/content/WritePost.js";
import User from "../models/users/User.js";
import logger from "../utils/logger.js";

/**
 * Create Write Post
 * @param {string} userId - User ID
 * @param {Object} postData - Post data (title, content, mentionedUserIds)
 * @returns {Promise<Object>} Created write post
 */
export const createWritePost = async (userId, postData) => {
  try {
    // Verify user exists and is not deleted
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Validate mentioned users if provided
    if (postData.mentionedUserIds && postData.mentionedUserIds.length > 0) {
      const mentionedUsers = await User.find({
        _id: { $in: postData.mentionedUserIds },
        isAccountVerified: true,
        isDeleted: false,
      });

      if (mentionedUsers.length !== postData.mentionedUserIds.length) {
        throw new Error("One or more mentioned users not found");
      }
    }

    // Create write post
    const writePost = new WritePost({
      userId,
      title: postData.title || "",
      content: postData.content.trim(),
      mentionedUserIds: postData.mentionedUserIds || [],
    });

    await writePost.save();

    // Populate user and mentioned users
    await writePost.populate([
      {
        path: "userId",
        select:
          "name username profileImage email isAccountVerified isVerifiedBadge",
      },
      {
        path: "mentionedUserIds",
        select:
          "name username profileImage email isAccountVerified isVerifiedBadge",
      },
    ]);

    logger.info(`Write post created: ${writePost._id} by user: ${userId}`);

    return writePost;
  } catch (error) {
    logger.error("Error in createWritePost:", error);
    throw error;
  }
};

export default {
  createWritePost,
};
