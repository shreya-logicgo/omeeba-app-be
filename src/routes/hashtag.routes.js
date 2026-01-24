import express from "express";
import { optionalProtect } from "../middleware/auth.js";
import { getTrending } from "../controllers/hashtag.controller.js";

const router = express.Router();

/**
 * @route   GET /api/v1/hashtags/trending
 * @desc    Get top trending hashtags with content count
 * @access  Public (optional auth)
 * @query   limit - Number of hashtags to return (default: 10, max: 50)
 */
router.get("/trending", optionalProtect, getTrending);

export default router;

