/**
 * Report Service
 * Business logic for report categories and sub-categories
 */

import {
  ReportCategory,
  ReportSubCategory,
  ContentReport,
  Post,
  WritePost,
  ZealPost,
  User,
} from "../models/index.js";
import { ContentType, ContentTypeToModelName } from "../models/enums.js";
import logger from "../utils/logger.js";

/**
 * Get all active report categories
 * @returns {Promise<Array>} List of active categories
 */
export const getCategories = async () => {
  try {
    const categories = await ReportCategory.find({ isActive: true })
      .select("_id name description displayOrder")
      .sort({ displayOrder: 1 })
      .lean();

    // Format response
    const formattedCategories = categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      displayOrder: category.displayOrder,
    }));

    return formattedCategories;
  } catch (error) {
    logger.error("Error in getCategories:", error);
    throw error;
  }
};

/**
 * Get sub-categories for a specific category
 * @param {string} categoryId - Category ID
 * @returns {Promise<Array>} List of active sub-categories for the category
 */
export const getSubCategoriesByCategory = async (categoryId) => {
  try {
    // Verify category exists and is active
    const category = await ReportCategory.findOne({
      _id: categoryId,
      isActive: true,
    });

    if (!category) {
      throw new Error("Category not found or inactive");
    }

    // Get sub-categories for this category
    const subCategories = await ReportSubCategory.find({
      categoryId: categoryId,
      isActive: true,
    })
      .select("_id name description displayOrder categoryId")
      .sort({ displayOrder: 1 })
      .lean();

    // Format response
    const formattedSubCategories = subCategories.map((subCategory) => ({
      id: subCategory._id.toString(),
      name: subCategory.name,
      description: subCategory.description,
      displayOrder: subCategory.displayOrder,
      categoryId: subCategory.categoryId.toString(),
    }));

    return {
      category: {
        id: category._id.toString(),
        name: category.name,
        description: category.description,
      },
      subCategories: formattedSubCategories,
    };
  } catch (error) {
    logger.error("Error in getSubCategoriesByCategory:", error);
    throw error;
  }
};

/**
 * Get all categories with their sub-categories
 * @returns {Promise<Array>} List of categories with nested sub-categories
 */
export const getCategoriesWithSubCategories = async () => {
  try {
    const categories = await ReportCategory.find({ isActive: true })
      .select("_id name description displayOrder")
      .sort({ displayOrder: 1 })
      .lean();

    // Get all sub-categories grouped by category
    const allSubCategories = await ReportSubCategory.find({ isActive: true })
      .select("_id name description displayOrder categoryId")
      .sort({ displayOrder: 1 })
      .lean();

    // Group sub-categories by categoryId
    const subCategoriesMap = {};
    allSubCategories.forEach((subCat) => {
      const catId = subCat.categoryId.toString();
      if (!subCategoriesMap[catId]) {
        subCategoriesMap[catId] = [];
      }
      subCategoriesMap[catId].push({
        id: subCat._id.toString(),
        name: subCat.name,
        description: subCat.description,
        displayOrder: subCat.displayOrder,
      });
    });

    // Format response with nested sub-categories
    const formattedCategories = categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      description: category.description,
      displayOrder: category.displayOrder,
      subCategories: subCategoriesMap[category._id.toString()] || [],
    }));

    return formattedCategories;
  } catch (error) {
    logger.error("Error in getCategoriesWithSubCategories:", error);
    throw error;
  }
};

/**
 * Create a report for content
 * @param {string} userId - ID of user reporting
 * @param {Object} reportData - Report data (contentType, contentId, categoryId, subCategoryId, details)
 * @returns {Promise<Object>} Created report
 */
export const createReport = async (userId, reportData) => {
  try {
    const { contentType, contentId, subCategoryId, details } = reportData;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      throw new Error("Invalid content type");
    }

    // Verify content exists
    const ContentModel = ContentTypeToModelName[contentType];
    let content;
    
    switch (ContentModel) {
      case "Post":
        content = await Post.findById(contentId);
        break;
      case "Write Post":
        content = await WritePost.findById(contentId);
        break;
      case "Zeal Post":
        content = await ZealPost.findById(contentId);
        break;
      default:
        throw new Error("Invalid content type");
    }

    if (!content) {
      throw new Error("Content not found");
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

    // Check if user has already reported this content
    const existingReport = await ContentReport.findOne({
      contentType,
      contentId,
      reportedBy: userId,
    });

    if (existingReport) {
      throw new Error("You have already reported this content");
    }

    // Create report
    const report = new ContentReport({
      contentType,
      contentId,
      reportedBy: userId,
      categoryId: categoryId.toString(),
      subCategoryId: subCategoryId,
      details: details ? details.trim() : "",
    });

    await report.save();

    logger.info(`Report created: ${report._id} by user ${userId} for ${contentType} ${contentId}. Content will be hidden for reporting user.`);

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
      contentType: report.contentType,
      contentId: report.contentId.toString(),
      category: formattedCategory,
      subCategory: formattedSubCategory,
      reportedBy: formattedUser,
      details: report.details,
      createdAt: report.createdAt,
    };
  } catch (error) {
    logger.error("Error in createReport:", error);
    throw error;
  }
};

export default {
  getCategories,
  getSubCategoriesByCategory,
  getCategoriesWithSubCategories,
  createReport,
};
