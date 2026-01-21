/**
 * Comment Report Service
 * Business logic for comment reporting
 */

import CommentReport from "../models/comments/CommentReport.js";
import Comment from "../models/comments/Comment.js";
import { User, ReportCategory, ReportSubCategory } from "../models/index.js";
import logger from "../utils/logger.js";

/**
 * Create a report for a comment
 * @param {string} userId - ID of user reporting
 * @param {string} commentId - Comment ID
 * @param {Object} reportData - Report data (subCategoryId, details)
 * @returns {Promise<Object>} Created report
 */
export const createCommentReport = async (userId, commentId, reportData) => {
  try {
    const { subCategoryId, details } = reportData;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Validate comment exists
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new Error("Comment not found");
    }

    // Prevent self-reporting
    if (comment.userId.toString() === userId) {
      throw new Error("You cannot report your own comment");
    }

    // Verify sub-category exists and get categoryId from it
    const subCategory = await ReportSubCategory.findOne({
      _id: subCategoryId,
      isActive: true,
    });

    if (!subCategory) {
      throw new Error("Sub-category not found or inactive");
    }

    // Get categoryId from subCategory
    const categoryId = subCategory.categoryId;

    // Verify category exists and is active
    const category = await ReportCategory.findOne({
      _id: categoryId,
      isActive: true,
    });

    if (!category) {
      throw new Error("Category not found or inactive");
    }

    // Check if user has already reported this comment
    const existingReport = await CommentReport.findOne({
      commentId,
      reportedBy: userId,
    });

    if (existingReport) {
      throw new Error("You have already reported this comment");
    }

    // Create report
    const report = new CommentReport({
      commentId,
      reportedBy: userId,
      categoryId: categoryId.toString(),
      subCategoryId: subCategoryId,
      details: details ? details.trim() : "",
    });

    await report.save();

    logger.info(`Comment report created: ${report._id} by user ${userId} for comment ${commentId}. Comment will be hidden for reporting user.`);

    // Fetch/Join related data manually
    const [categoryData, subCategoryData, userData] = await Promise.all([
      ReportCategory.findById(categoryId)
        .select("_id name description displayOrder isActive")
        .lean(),
      subCategoryId
        ? ReportSubCategory.findById(subCategoryId)
            .select("_id name description displayOrder isActive categoryId")
            .lean()
        : null,
      User.findById(userId).select("_id name username email profileImage").lean(),
    ]);

    // Format category
    const formattedCategory = categoryData
      ? {
          id: categoryData._id.toString(),
          name: categoryData.name,
          description: categoryData.description,
          displayOrder: categoryData.displayOrder,
          isActive: categoryData.isActive,
        }
      : null;

    // Format sub-category
    const formattedSubCategory = subCategoryData
      ? {
          id: subCategoryData._id.toString(),
          name: subCategoryData.name,
          description: subCategoryData.description,
          displayOrder: subCategoryData.displayOrder,
          isActive: subCategoryData.isActive,
          categoryId: subCategoryData.categoryId
            ? subCategoryData.categoryId.toString()
            : null,
        }
      : null;

    // Format user (reportedBy)
    const formattedUser = userData
      ? {
          id: userData._id.toString(),
          name: userData.name,
          username: userData.username,
          email: userData.email,
          profileImage: userData.profileImage,
        }
      : null;

    // Return formatted report with joined data
    return {
      id: report._id.toString(),
      commentId: report.commentId.toString(),
      category: formattedCategory,
      subCategory: formattedSubCategory,
      reportedBy: formattedUser,
      details: report.details,
      createdAt: report.createdAt,
    };
  } catch (error) {
    logger.error("Error in createCommentReport:", error);
    throw error;
  }
};

export default {
  createCommentReport,
};
