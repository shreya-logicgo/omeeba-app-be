import { createWritePost as createWritePostService } from "../services/writePost.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Create Write Post
 * @route POST /api/v1/write-posts
 * @access Private
 */
export const createWritePost = async (req, res) => {
  try {
    const userId = req.user._id;
    const postData = req.body;

    // Create write post
    const writePost = await createWritePostService(userId, postData);

    // Return success response
    return sendSuccess(
      res,
      {
        writePost: {
          id: writePost._id,
          title: writePost.title,
          content: writePost.content,
          userId: {
            id: writePost.userId._id,
            name: writePost.userId.name,
            username: writePost.userId.username,
            profileImage: writePost.userId.profileImage,
            isAccountVerified: writePost.userId.isAccountVerified,
            isVerifiedBadge: writePost.userId.isVerifiedBadge,
          },
          mentionedUsers: writePost.mentionedUserIds.map((user) => ({
            id: user._id,
            name: user.name,
            username: user.username,
            profileImage: user.profileImage,
            isAccountVerified: user.isAccountVerified,
            isVerifiedBadge: user.isVerifiedBadge,
          })),
          createdAt: writePost.createdAt,
          updatedAt: writePost.updatedAt,
        },
      },
      "Write post created successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create write post error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to create write post",
      "Create Write Post Error",
      error.message || "An error occurred while creating write post",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  createWritePost,
};

