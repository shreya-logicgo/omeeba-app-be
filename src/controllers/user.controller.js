import {
  updateProfile as updateProfileService,
  getUserProfile as getUserProfileService,
} from "../services/user.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
  sendPaginated,
} from "../utils/response.js";
import { searchUsersByUsername, searchUsersForMentions } from "../services/user.service.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import Post from "../models/content/Post.js";
import mongoose from "mongoose";
import WritePost from "../models/content/WritePost.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";
import Poll from "../models/content/Poll.js";
import ContentLike from "../models/interactions/ContentLike.js";
import Comment from "../models/comments/Comment.js";
import { ContentType } from "../models/enums.js";

/**
 * Update Profile
 * @route PUT /api/v1/users/profile
 * @access Private
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    // Update profile
    const user = await updateProfileService(userId, updateData);

    // Return success response
    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          bio: user.bio,
          profileImage: user.profileImage,
          coverImage: user.coverImage,
          isAccountVerified: user.isAccountVerified,
          isVerifiedBadge: user.isVerifiedBadge,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      "Profile updated successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Update profile error:", error);
  }
};

/*
 * Search users by username
 * @route GET /api/v1/users/search
 * @access Private
 */
export const searchUsers = async (req, res) => {
  try {
    const searchTerm = req.query.username || req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const currentUserId = req.user._id.toString();

    // Get search results
    const result = await searchUsersByUsername(
      searchTerm,
      currentUserId,
      page,
      limit
    );

    return sendSuccess(
      res,
      result,
      "Users retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Search users error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to update profile",
      "Update Profile Error",
      error.message || "An error occurred while updating profile",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get User Profile
 * @route GET /api/v1/users/:userId/profile
 * @route GET /api/v1/users/profile (for own profile)
 * @access Private (for own profile) / Public (for other users)
 */
export const getUserProfile = async (req, res) => {
  try {
    // Get userId from params or use authenticated user's ID
    const targetUserId = req.params.userId || req.user._id.toString();
    const viewerId = req.user ? req.user._id.toString() : null;

    // Get profile
    const profile = await getUserProfileService(targetUserId, viewerId);

    // Return success response
    return sendSuccess(
      res,
      {
        profile,
      },
      "Profile retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get user profile error:", error);

    // Handle custom errors
    if (
      error.message === "User not found" ||
      error.message === "User account has been deleted"
    ) {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get profile",
      "Get Profile Error",
      error.message || "An error occurred while retrieving profile",
      "Failed to search users",
      "User Search Error",
      error.message || "An error occurred while searching users",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get user posts
 */
export const getUserPost = async (req, res) => {
  try {
    const filter = {};
    const { date, userId } = req.query;

    filter.userId = userId ? new mongoose.Types.ObjectId(userId) : req.user._id;

    if (date) {
      // date format: YYYY-MM-DD
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(`${date}T23:59:59.999Z`);

      filter.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    // Get pagination parameters
    const { page, limit, skip } = getPagination(req);

    // Get total count for pagination
    const total = await Post.countDocuments(filter);

    // Get paginated posts
    const userPosts = await Post.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "userId",
        "name username profileImage isAccountVerified isVerifiedBadge"
      )
      .populate(
        "mentionedUserIds",
        "name username profileImage isAccountVerified isVerifiedBadge"
      );

    // Get pagination metadata
    const pagination = getPaginationMeta(total, page, limit);

    return sendPaginated(
      res,
      userPosts,
      pagination,
      "User post fetch successfully.",
      StatusCodes.OK
    );
  } catch (error) {
    return sendError(
      res,
      "Failed to get user posts",
      "Get user posts",
      error.message || "An error occurred while retrieving user posts.",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get user's write posts
 */
export const getUserWritePosts = async (req, res) => {
  try {
    const filter = {};
    const { date, userId } = req.query;

    filter.userId = userId ? new mongoose.Types.ObjectId(userId) : req.user._id;

    if (date) {
      // date format: YYYY-MM-DD
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(`${date}T23:59:59.999Z`);

      filter.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    // Get pagination parameters
    const { page, limit, skip } = getPagination(req);

    // Get total count for pagination
    const total = await WritePost.countDocuments(filter);

    // Get paginated posts
    const userPosts = await WritePost.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "userId",
        "name username profileImage isAccountVerified isVerifiedBadge"
      )
      .populate(
        "mentionedUserIds",
        "name username profileImage isAccountVerified isVerifiedBadge"
      );

    // Get pagination metadata
    const pagination = getPaginationMeta(total, page, limit);

    return sendPaginated(
      res,
      userPosts,
      pagination,
      "User post fetch successfully.",
      StatusCodes.OK
    );
  } catch (error) {
    return sendError(
      res,
      "Failed to get user posts",
      "Get user posts",
      error.message || "An error occurred while retrieving user posts.",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get user's polls
 */
export const getUserPolls = async (req, res) => {
  try {
    const filter = {};
    const { date, createdBy } = req.query;

    filter.createdBy = createdBy
      ? new mongoose.Types.ObjectId(createdBy)
      : req.user._id;

    if (date) {
      // date format: YYYY-MM-DD
      const startDate = new Date(`${date}T00:00:00.000Z`);
      const endDate = new Date(`${date}T23:59:59.999Z`);

      filter.createdAt = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    console.log(filter);

    // Get pagination parameters
    const { page, limit, skip } = getPagination(req);

    // Get total count for pagination
    const total = await Poll.countDocuments(filter);

    // Get paginated polls
    const userPosts = await Poll.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(
        "createdBy",
        "name username profileImage isAccountVerified isVerifiedBadge"
      )
      .populate(
        "userVotes.userId",
        "name username profileImage isAccountVerified isVerifiedBadge"
      );

    // Get pagination metadata
    const pagination = getPaginationMeta(total, page, limit);

    return sendPaginated(
      res,
      userPosts,
      pagination,
      "User polls fetch successfully.",
      StatusCodes.OK
    );
  } catch (error) {
    return sendError(
      res,
      "Failed to get user posts",
      "Get user posts",
      error.message || "An error occurred while retrieving user posts.",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get posts where user is mentioned
 */
export const getMentionedPosts = async (req, res) => {
  try {
    // Get userId from query or use logged-in user's ID
    const targetUserId = req.query.userId
      ? new mongoose.Types.ObjectId(req.query.userId)
      : req.user._id;

    // Get pagination parameters
    const { page, limit, skip } = getPagination(req);

    // Get total counts for pagination
    const [postCount, writePostCount] = await Promise.all([
      Post.countDocuments({
        mentionedUserIds: { $in: [targetUserId] },
      }),
      WritePost.countDocuments({
        mentionedUserIds: { $in: [targetUserId] },
      }),
    ]);
    const total = postCount + writePostCount;

    // Query both Post and WritePost where mentionedUserIds contains the userId
    // Fetch enough records to ensure we have data after merging and sorting
    const fetchLimit = skip + limit + 100; // Fetch extra to ensure we have enough after merge
    const [posts, writePosts] = await Promise.all([
      Post.find({
        mentionedUserIds: { $in: [targetUserId] },
      })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .populate(
          "userId",
          "name username profileImage isAccountVerified isVerifiedBadge"
        )
        .populate(
          "mentionedUserIds",
          "name username profileImage isAccountVerified isVerifiedBadge"
        )
        .lean(),
      WritePost.find({
        mentionedUserIds: { $in: [targetUserId] },
      })
        .sort({ createdAt: -1 })
        .limit(fetchLimit)
        .populate(
          "userId",
          "name username profileImage isAccountVerified isVerifiedBadge"
        )
        .populate(
          "mentionedUserIds",
          "name username profileImage isAccountVerified isVerifiedBadge"
        )
        .lean(),
    ]);

    // Combine and transform posts with contentType
    const combinedPosts = [
      ...posts.map((post) => ({
        ...post,
        contentType: ContentType.POST,
        _id: post._id,
      })),
      ...writePosts.map((post) => ({
        ...post,
        contentType: ContentType.WRITE_POST,
        _id: post._id,
      })),
    ];

    // Sort by createdAt descending (latest first)
    combinedPosts.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return dateB - dateA;
    });

    // Apply pagination
    const paginatedPosts = combinedPosts.slice(skip, skip + limit);

    // Get like and comment counts for all posts
    const postsWithCounts = await Promise.all(
      paginatedPosts.map(async (post) => {
        const [likeCount, commentCount] = await Promise.all([
          ContentLike.countDocuments({
            contentType: post.contentType,
            contentId: post._id,
          }),
          Comment.countDocuments({
            contentType: post.contentType,
            contentId: post._id,
          }),
        ]);

        return {
          ...post,
          likeCount,
          commentCount,
        };
      })
    );

    // Get pagination metadata
    const pagination = getPaginationMeta(total, page, limit);

    return sendPaginated(
      res,
      postsWithCounts,
      pagination,
      "Mentioned posts fetched successfully.",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get mentioned posts error:", error);
    return sendError(
      res,
      "Failed to get mentioned posts",
      "Get mentioned posts",
      error.message || "An error occurred while retrieving mentioned posts.",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Search users for mention autocomplete
 * @route GET /api/v1/users/mentions/search
 * @access Private
 */
export const searchUsersForMentionsHandler = async (req, res) => {
  try {
    const searchTerm = req.query.q || req.query.query || "";
    const limit = parseInt(req.query.limit) || 10;
    const currentUserId = req.user._id.toString();

    // Get mention suggestions
    const users = await searchUsersForMentions(searchTerm, currentUserId, limit);

    return sendSuccess(
      res,
      { users },
      "Mention suggestions retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Search users for mentions error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to search users for mentions",
      "Mention Search Error",
      error.message || "An error occurred while searching users",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  updateProfile,
  getUserProfile,
  searchUsers,
  getUserPost,
  getUserWritePosts,
  getUserPolls,
  getMentionedPosts,
  searchUsersForMentionsHandler,
};
