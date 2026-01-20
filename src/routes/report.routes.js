/**
 * Report Routes
 * Routes for report categories and sub-categories endpoints
 */

import express from "express";
import {
  getAllCategories,
  getSubCategories,
  getCategoriesWithSubs,
  createReportHandler,
} from "../controllers/report.controller.js";
import { validateParams, validateBody } from "../utils/validation.js";
import {
  getSubCategoriesParamsSchema,
  createReportBodySchema,
} from "../validators/report.validator.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/v1/reports
 * @desc    Create a report for content
 * @access  Private
 */
router.post(
  "/",
  protect,
  validateBody(createReportBodySchema),
  createReportHandler
);

/**
 * @route   GET /api/v1/reports/categories
 * @desc    Get all active report categories
 * @access  Private
 */
router.get("/categories", protect, getAllCategories);

/**
 * @route   GET /api/v1/reports/categories/with-subcategories
 * @desc    Get all categories with their sub-categories
 * @access  Private
 */
router.get("/categories/with-subcategories", protect, getCategoriesWithSubs);

/**
 * @route   GET /api/v1/reports/categories/:categoryId/subcategories
 * @desc    Get sub-categories for a specific category
 * @access  Private
 */
router.get(
  "/categories/:categoryId/subcategories",
  protect,
  validateParams(getSubCategoriesParamsSchema),
  getSubCategories
);

export default router;
