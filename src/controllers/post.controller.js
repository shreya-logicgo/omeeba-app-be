import { createPost as createPostService } from "../services/post.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create Post
 * @route POST /api/v1/posts
 * @access Private
 */
export const createPost = async (req, res) => {
  try {
    const userId = req.user._id;
    const postData = req.body;

    // Create post
    const post = await createPostService(userId, postData);

    // Format music data if present
    let musicData = null;
    if (post.musicId) {
      musicData = {
        id: post.musicId._id,
        title: post.musicId.title,
        artist: post.musicId.artist,
        album: post.musicId.album,
        coverImage: post.musicId.coverImage,
        duration: post.musicId.duration,
      };
    }

    // Return success response
    return sendSuccess(
      res,
      {
        post: {
          id: post._id,
          caption: post.caption,
          images: post.images,
          userId: {
            id: post.userId._id,
            name: post.userId.name,
            username: post.userId.username,
            profileImage: post.userId.profileImage,
            isAccountVerified: post.userId.isAccountVerified,
            isVerifiedBadge: post.userId.isVerifiedBadge,
          },
          mentionedUsers: post.mentionedUserIds.map((user) => ({
            id: user._id,
            name: user.name,
            username: user.username,
            profileImage: user.profileImage,
            isAccountVerified: user.isAccountVerified,
            isVerifiedBadge: user.isVerifiedBadge,
          })),
          music: musicData,
          musicStartTime: post.musicStartTime,
          musicEndTime: post.musicEndTime,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
      },
      "Post created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create post error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to create post",
      "Create Post Error",
      error.message || "An error occurred while creating post",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  createPost,
};
