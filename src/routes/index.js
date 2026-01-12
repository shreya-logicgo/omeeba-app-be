import express from "express";
import { API_VERSION } from "../config/env.js";

const router = express.Router();

// Health check
router.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    version: API_VERSION,
  });
});

// Import route modules
// TODO: Uncomment when routes are created
// import authRoutes from "./auth.routes.js";
// import userRoutes from "./user.routes.js";
// import postRoutes from "./post.routes.js";
// import commentRoutes from "./comment.routes.js";
// import chatRoutes from "./chat.routes.js";
// import notificationRoutes from "./notification.routes.js";

// Mount routes
// router.use(`/${API_VERSION}/auth`, authRoutes);
// router.use(`/${API_VERSION}/users`, userRoutes);
// router.use(`/${API_VERSION}/posts`, postRoutes);
// router.use(`/${API_VERSION}/comments`, commentRoutes);
// router.use(`/${API_VERSION}/chat`, chatRoutes);
// router.use(`/${API_VERSION}/notifications`, notificationRoutes);

export default router;

