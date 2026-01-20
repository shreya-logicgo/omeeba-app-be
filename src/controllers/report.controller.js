/**
 * Report Controller
 * Handles HTTP requests for report categories and sub-categories
 */

import {
  getCategories,
  getSubCategoriesByCategory,
  getCategoriesWithSubCategories,
  createReport,
} from "../services/report.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Get all report categories
 * @route GET /api/v1/reports/categories
 * @access Private
 */
export const getAllCategories = async (req, res) => {
  try {
    const categories = await getCategories();

    return sendSuccess(
      res,
      { categories },
      "Categories retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get categories error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to retrieve categories",
      "Server Error",
      error.message || "An error occurred while retrieving categories",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get sub-categories for a specific category
 * @route GET /api/v1/reports/categories/:categoryId/subcategories
 * @access Private
 */
export const getSubCategories = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const result = await getSubCategoriesByCategory(categoryId);

    return sendSuccess(
      res,
      result,
      "Sub-categories retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get sub-categories error:", error);

    if (error.message === "Category not found or inactive") {
      return sendNotFound(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to retrieve sub-categories",
      "Server Error",
      error.message || "An error occurred while retrieving sub-categories",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get all categories with their sub-categories
 * @route GET /api/v1/reports/categories/with-subcategories
 * @access Private
 */
export const getCategoriesWithSubs = async (req, res) => {
  try {
    const categories = await getCategoriesWithSubCategories();

    return sendSuccess(
      res,
      { categories },
      "Categories with sub-categories retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get categories with sub-categories error:", error);

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to retrieve categories with sub-categories",
      "Server Error",
      error.message || "An error occurred while retrieving categories",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Create a report for content
 * @route POST /api/v1/reports
 * @access Private
 */
export const createReportHandler = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const reportData = req.body;

    const report = await createReport(userId, reportData);

    return sendSuccess(
      res,
      { report },
      "Report submitted successfully. This content has been hidden from your feed and will no longer appear in your search results, profile listings, or content detail views.",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create report error:", error);

    // Handle specific errors
    if (
      error.message === "Content not found" ||
      error.message === "Category not found or inactive" ||
      error.message === "Sub-category not found or inactive" ||
      error.message === "You have already reported this content" ||
      error.message === "Invalid content type"
    ) {
      return sendBadRequest(res, error.message);
    }

    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    return sendError(
      res,
      "Failed to submit report",
      "Server Error",
      error.message || "An error occurred while submitting report",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getAllCategories,
  getSubCategories,
  getCategoriesWithSubs,
  createReportHandler,
};
