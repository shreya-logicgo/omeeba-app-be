import { Router } from 'express';
import legalController from '../controllers/legal.controller.js';

const router = Router();

/**
 * @route   GET /api/legal/privacy
 * @desc    Get privacy policy content
 * @access  Public
 */
router.get('/privacy', legalController.getPrivacyPolicy);

/**
 * @route   GET /api/legal/terms
 * @desc    Get terms and conditions content
 * @access  Public
 */
router.get('/terms', legalController.getTermsAndConditions);

export default router;
