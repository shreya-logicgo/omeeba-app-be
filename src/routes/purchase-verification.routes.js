/**
 * Purchase Verification Routes
 * Routes for in-app purchase verification from Apple App Store and Google Play Store
 */

import express from "express";
import { protect } from "../middleware/auth.js";
import {
  verifyApplePurchaseController,
  verifyGooglePurchaseController,
  restorePurchasesController,
  getVerifiedStatusController,
} from "../controllers/purchase-verification.controller.js";
import {
  validateVerifyApplePurchase,
  validateVerifyGooglePurchase,
  validateRestorePurchases,
} from "../validators/purchase-verification.validator.js";

const router = express.Router();

/**
 * @route   POST /api/v1/purchases/verify/apple
 * @desc    Verify Apple App Store purchase and grant verified badge
 * @access  Private
 */
router.post(
  "/verify/apple",
  protect,
  validateVerifyApplePurchase,
  verifyApplePurchaseController
);

/**
 * @route   POST /api/v1/purchases/verify/google
 * @desc    Verify Google Play Store purchase and grant verified badge
 * @access  Private
 */
router.post(
  "/verify/google",
  protect,
  validateVerifyGooglePurchase,
  verifyGooglePurchaseController
);

/**
 * @route   GET /api/v1/purchases/restore
 * @desc    Restore purchases for the authenticated user
 * @access  Private
 */
router.get(
  "/restore",
  protect,
  validateRestorePurchases,
  restorePurchasesController
);

/**
 * @route   GET /api/v1/purchases/status
 * @desc    Get user's verified badge status and subscription info
 * @access  Private
 */
router.get("/status", protect, getVerifiedStatusController);

export default router;
