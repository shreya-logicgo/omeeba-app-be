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
import zealRoutes from "./zeal.routes.js";
import followRoutes from "./follow.routes.js";
import userRoutes from "./user.routes.js";

// Mount routes
router.use(`/${config.apiVersion}/auth`, authRoutes);
router.use(`/${config.apiVersion}/zeals`, zealRoutes);
router.use(`/${config.apiVersion}/follow`, followRoutes);
router.use(`/${config.apiVersion}/users`, userRoutes);

export default router;
