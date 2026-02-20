/**
 * Content Deletion Service
 * Delete Post, Zeal, Write Post, Poll (owner only, hard delete)
 */

import {
  Post,
  WritePost,
  ZealPost,
  Poll,
  User,
  ContentLike,
  ContentShare,
  SavedContent,
} from "../models/index.js";
import Comment from "../models/comments/Comment.js";
import { ContentType } from "../models/enums.js";
import logger from "../utils/logger.js";
import mongoose from "mongoose";

/**
 * Validate user and ownership helper
 */
const validateUser = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.isDeleted) throw new Error("User account has been deleted");
  return user;
};

/**
 * Delete related engagement data for a content item
 */
const deleteRelatedContentData = async (contentType, contentId) => {
  const id = new mongoose.Types.ObjectId(contentId);
  await Promise.all([
    ContentLike.deleteMany({ contentType, contentId: id }),
    ContentShare.deleteMany({ contentType, contentId: id }),
    SavedContent.deleteMany({ contentType, contentId: id }),
    Comment.deleteMany({ contentType, contentId: id }),
  ]);
  // Reply comments are tied to comments; when comments are deleted, reply refs break. Optionally delete replies by commentId from Comment docs - for simplicity we only delete top-level comments here.
};

/**
 * Delete a Post (owner only)
 * @param {string} userId - User ID
 * @param {string} postId - Post ID
 * @returns {Promise<Object>}
 */
export const deletePost = async (userId, postId) => {
  try {
    await validateUser(userId);
    const post = await Post.findById(postId);
    if (!post) throw new Error("Post not found");
    if (post.userId.toString() !== userId) {
      throw new Error("You can only delete your own posts");
    }
    await deleteRelatedContentData(ContentType.POST, postId);
    await Post.findByIdAndDelete(postId);
    logger.info(`Post deleted: ${postId} by user ${userId}`);
    return { postId, message: "Post deleted successfully" };
  } catch (error) {
    logger.error("Error in deletePost:", error);
    throw error;
  }
};

/**
 * Delete a Zeal post (owner only)
 * @param {string} userId - User ID
 * @param {string} zealId - Zeal post ID
 * @returns {Promise<Object>}
 */
export const deleteZeal = async (userId, zealId) => {
  try {
    await validateUser(userId);
    const zeal = await ZealPost.findById(zealId);
    if (!zeal) throw new Error("Zeal not found");
    if (zeal.userId.toString() !== userId) {
      throw new Error("You can only delete your own zeals");
    }
    await deleteRelatedContentData(ContentType.ZEAL, zealId);
    await ZealPost.findByIdAndDelete(zealId);
    logger.info(`Zeal deleted: ${zealId} by user ${userId}`);
    return { zealId, message: "Zeal deleted successfully" };
  } catch (error) {
    logger.error("Error in deleteZeal:", error);
    throw error;
  }
};

/**
 * Delete a Write Post (owner only)
 * @param {string} userId - User ID
 * @param {string} writePostId - Write post ID
 * @returns {Promise<Object>}
 */
export const deleteWritePost = async (userId, writePostId) => {
  try {
    await validateUser(userId);
    const writePost = await WritePost.findById(writePostId);
    if (!writePost) throw new Error("Write post not found");
    if (writePost.userId.toString() !== userId) {
      throw new Error("You can only delete your own write posts");
    }
    await deleteRelatedContentData(ContentType.WRITE_POST, writePostId);
    await WritePost.findByIdAndDelete(writePostId);
    logger.info(`Write post deleted: ${writePostId} by user ${userId}`);
    return { writePostId, message: "Write post deleted successfully" };
  } catch (error) {
    logger.error("Error in deleteWritePost:", error);
    throw error;
  }
};

/**
 * Delete a Poll (creator only)
 * @param {string} userId - User ID
 * @param {string} pollId - Poll ID
 * @returns {Promise<Object>}
 */
export const deletePoll = async (userId, pollId) => {
  try {
    await validateUser(userId);
    const poll = await Poll.findById(pollId);
    if (!poll) throw new Error("Poll not found");
    if (poll.createdBy.toString() !== userId) {
      throw new Error("You can only delete your own polls");
    }
    // Poll uses ContentType or similar in ContentLike/ContentShare if applicable - check enums
    const contentTypePoll = "Poll";
    const id = new mongoose.Types.ObjectId(pollId);
    await Promise.all([
      ContentLike.deleteMany({ contentType: contentTypePoll, contentId: id }),
      ContentShare.deleteMany({ contentType: contentTypePoll, contentId: id }),
      SavedContent.deleteMany({ contentType: contentTypePoll, contentId: id }),
    ]);
    await Poll.findByIdAndDelete(pollId);
    logger.info(`Poll deleted: ${pollId} by user ${userId}`);
    return { pollId, message: "Poll deleted successfully" };
  } catch (error) {
    logger.error("Error in deletePoll:", error);
    throw error;
  }
};

export default {
  deletePost,
  deleteZeal,
  deleteWritePost,
  deletePoll,
};
