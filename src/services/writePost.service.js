import WritePost from "../models/content/WritePost.js";
import User from "../models/users/User.js";
import logger from "../utils/logger.js";
import { linkHashtagsToContent, extractHashtags } from "./hashtag.service.js";
import { ContentType, NotificationType } from "../models/enums.js";
import { createNotification } from "./notification.service.js";

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
      content: postData.content.trim(),
      mentionedUserIds: postData.mentionedUserIds || [],
    });

    await writePost.save();

    // Link hashtags to content (async, don't wait)
    if (postData.content) {
      const tags = extractHashtags(postData.content);
      if (tags.length > 0) {
        linkHashtagsToContent(ContentType.WRITE_POST, writePost._id, tags).catch(
          (error) => {
            logger.error(`Error linking hashtags for writePost ${writePost._id}:`, error);
          }
        );
      }
    }

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

    // Create notifications for mentioned users
    if (postData.mentionedUserIds && postData.mentionedUserIds.length > 0) {
      for (const mentionedUserId of postData.mentionedUserIds) {
        try {
          await createNotification({
            receiverId: mentionedUserId,
            senderId: userId,
            type: NotificationType.MENTION_IN_WRITE,
            contentType: ContentType.WRITE_POST,
            contentId: writePost._id,
            message: postData.content || ""
          });
        } catch (error) {
          logger.error(`Error creating mention notification for user ${mentionedUserId}:`, error);
        }
      }
    }

    return writePost;
  } catch (error) {
    logger.error("Error in createWritePost:", error);
    throw error;
  }
};

export default {
  createWritePost,
};
