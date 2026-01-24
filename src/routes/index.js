import express from "express";
import config from "../config/env.js";

const router = express.Router();

// Health check
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    version: config.apiVersion,
  });
});

// Import route modules
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import writePostRoutes from "./writePost.routes.js";
import postRoutes from "./post.routes.js";
import zealRoutes from "./zeal.routes.js";
import followRoutes from "./follow.routes.js";
import pollRoutes from "./poll.routes.js";
import reportRoutes from "./report.routes.js";
import contentLikeRoutes from "./content-like.routes.js";
import contentShareRoutes from "./content-share.routes.js";
import purchaseVerificationRoutes from "./purchase-verification.routes.js";
import savedContentRoutes from "./saved-content.routes.js";
import exploreRoutes from "./explore.routes.js";

// Mount routes
router.use(`/${config.apiVersion}/auth`, authRoutes);
router.use(`/${config.apiVersion}/users`, userRoutes);
router.use(`/${config.apiVersion}/write-posts`, writePostRoutes);
router.use(`/${config.apiVersion}/posts`, postRoutes);
router.use(`/${config.apiVersion}/zeals`, zealRoutes);
router.use(`/${config.apiVersion}/follow`, followRoutes);
router.use(`/${config.apiVersion}/polls`, pollRoutes);
router.use(`/${config.apiVersion}/reports`, reportRoutes);
router.use(`/${config.apiVersion}/content-likes`, contentLikeRoutes);
router.use(`/${config.apiVersion}/content-shares`, contentShareRoutes);
router.use(`/${config.apiVersion}/purchases`, purchaseVerificationRoutes);
router.use(`/${config.apiVersion}/saved-content`, savedContentRoutes);
router.use(`/${config.apiVersion}/explore`, exploreRoutes);

export default router;
