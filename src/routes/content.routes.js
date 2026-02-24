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
import { upload } from "../middleware/upload.js"; // use your custom upload middleware

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
  upload.any(), // use your diskStorage upload
  (req, res, next) => {
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Normalize existing body arrays
    if (req.body.images && !Array.isArray(req.body.images)) {
      req.body.images = [req.body.images];
    }

    if (req.body.videos && !Array.isArray(req.body.videos)) {
      req.body.videos = [req.body.videos];
    }

    // Merge uploaded files
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const fileUrl = `${baseUrl}/uploads/${file.filename}`;

        if (file.fieldname === "images") {
          if (!req.body.images) req.body.images = [];
          req.body.images.push(fileUrl);
        }

        if (file.fieldname === "videos") {
          if (!req.body.videos) req.body.videos = [];
          req.body.videos.push(fileUrl);
        }
      });
    }

    next();
  },
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