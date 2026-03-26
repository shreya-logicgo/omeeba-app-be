import Post from "../models/content/Post.js";
import User from "../models/users/User.js";
import Music from "../models/music/Music.js";
import logger from "../utils/logger.js";
import { linkHashtagsToContent, extractHashtags } from "./hashtag.service.js";
import { ContentType, NotificationType } from "../models/enums.js";
import { createNotification } from "./notification.service.js";

/**
 * Create Post
 * @param {string} userId - User ID
 * @param {Object} postData - Post data (caption, images, mentionedUserIds, musicId, musicStartTime, musicEndTime)
 * @returns {Promise<Object>} Created post
 */
export const createPost = async (userId, postData) => {
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
        isDeleted: false,
      });

      if (mentionedUsers.length !== postData.mentionedUserIds.length) {
        throw new Error("One or more mentioned users not found");
      }
    }

    // Validate music if provided
    if (postData.musicId) {
      const music = await Music.findById(postData.musicId);
      if (!music) {
        throw new Error("Music not found");
      }
      if (!music.isActive) {
        throw new Error("Music is not available");
      }

      // Validate music time range
      if (
        postData.musicStartTime !== null &&
        postData.musicStartTime !== undefined
      ) {
        if (postData.musicStartTime < 0) {
          throw new Error("Music start time must be 0 or greater");
        }
        if (postData.musicStartTime >= music.duration) {
          throw new Error("Music start time cannot exceed music duration");
        }
      }

      if (
        postData.musicEndTime !== null &&
        postData.musicEndTime !== undefined
      ) {
        if (postData.musicEndTime < 0) {
          throw new Error("Music end time must be 0 or greater");
        }
        if (postData.musicEndTime > music.duration) {
          throw new Error("Music end time cannot exceed music duration");
        }
        if (
          postData.musicStartTime !== null &&
          postData.musicStartTime !== undefined &&
          postData.musicEndTime <= postData.musicStartTime
        ) {
          throw new Error("Music end time must be greater than start time");
        }
      }
    } else {
      // If no music, clear music times
      postData.musicStartTime = null;
      postData.musicEndTime = null;
    }

    // Validate images
    if (!postData.images || postData.images.length === 0) {
      throw new Error("At least one image is required");
    }

    // Create post
    const post = new Post({
      userId,
      caption: postData.caption || "",
      images: postData.images || [],
      mentionedUserIds: postData.mentionedUserIds || [],
      musicId: postData.musicId || null,
      musicStartTime: postData.musicStartTime || null,
      musicEndTime: postData.musicEndTime || null,
    });

    await post.save();

    // Link hashtags to content (async, don't wait)
    if (postData.caption) {
      const tags = extractHashtags(postData.caption);
      if (tags.length > 0) {
        linkHashtagsToContent(ContentType.POST, post._id, tags).catch(
          (error) => {
            logger.error(`Error linking hashtags for post ${post._id}:`, error);
          }
        );
      }
    }

    // Populate user, mentioned users, and music
    await post.populate([
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
      {
        path: "musicId",
        select: "title artist album coverImage duration",
      },
    ]);

    logger.info(`Post created: ${post._id} by user: ${userId}`);

    // Create notifications for mentioned users
    if (postData.mentionedUserIds && postData.mentionedUserIds.length > 0) {
      for (const mentionedUserId of postData.mentionedUserIds) {
        try {
          await createNotification({
            receiverId: mentionedUserId,
            senderId: userId,
            type: "MENTION_IN_POST",
            contentType: ContentType.POST,
            contentId: post._id,
            message: post.caption || ""
          });
        } catch (error) {
          logger.error(`Error creating mention notification for user ${mentionedUserId}:`, error);
        }
      }
    }

    // Create TAG notifications for tagged users (if different from mentions)
    if (postData.taggedUserIds && postData.taggedUserIds.length > 0) {
      logger.info(`Creating TAG notifications for ${postData.taggedUserIds.length} tagged users:`, postData.taggedUserIds);
      
      for (const taggedUserId of postData.taggedUserIds) {
        try {
          // Skip if user is also in mentionedUserIds to avoid duplicate notifications
          if (postData.mentionedUserIds && postData.mentionedUserIds.includes(taggedUserId)) {
            logger.info(`Skipping TAG notification for user ${taggedUserId} - already in mentionedUserIds`);
            continue;
          }
          
          logger.info(`Creating TAG notification for user ${taggedUserId} from sender ${userId}`);
          const notification = await createNotification({
            receiverId: taggedUserId,
            senderId: userId,
            type: NotificationType.TAG,
            contentType: ContentType.POST,
            contentId: post._id,
            message: "tagged you in a post"
          });
          
          logger.info(`TAG notification created: ${notification?._id} for user ${taggedUserId}`);
        } catch (error) {
          logger.error(`Error creating tag notification for user ${taggedUserId}:`, error);
        }
      }
    } else {
      logger.info(`No taggedUserIds provided in post data`);
    }

    return post;
  } catch (error) {
    logger.error("Error in createPost:", error);
    throw error;
  }
};

export default {
  createPost,
};
