// routes/content.routes.js
import express from "express";
import {
  getContentController,
  updateContentController,
  deleteContentController,
} from "../controllers/content.controller.js";
import { protect } from "../middleware/auth.js";
import {
  validateContentParams,
  validateContentUpdate,
} from "../validators/content.validator.js";
import { upload } from "../middleware/upload.js";

const router = express.Router();

// Get single content
router.get(
  "/:contentType/:contentId",
  validateContentParams,
  getContentController
);

// Update content
router.put(
  "/:contentType/:contentId",
  protect,
  validateContentParams,
  upload.any(),   // multer memory storage
  validateContentUpdate,
  updateContentController
);

// Delete content
router.delete(
  "/:contentType/:contentId",
  protect,
  validateContentParams,
  deleteContentController
);

export default router;