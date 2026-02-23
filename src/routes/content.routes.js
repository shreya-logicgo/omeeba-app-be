import express from "express";
import {
    getContentController,
    updateContentController,
    deleteContentController
} from "../controllers/content.controller.js";
import { protect } from "../middleware/auth.js";
import { validateContentParams, validateContentUpdate } from "../validators/content.validator.js";
import multer from "multer";

const router = express.Router();
const upload = multer({ dest: "uploads/" }); // adjust storage as needed

// Get single content
router.get("/:contentType/:contentId", validateContentParams, getContentController);

// Update content
router.put(
  "/:contentType/:contentId",
  protect,
  validateContentParams,
  upload.any(), // accept any file fields
  (req, res, next) => {
    // Merge allowed file fields into req.body
    if (req.files && req.files.length > 0) {
      req.files.forEach(file => {
        if (file.fieldname === "images") {
          if (!req.body.images) req.body.images = [];
          req.body.images.push(file.path);
        } else if (file.fieldname === "videos") {
          if (!req.body.videos) req.body.videos = [];
          req.body.videos.push(file.path);
        }
      });
    }
    next();
  },
  validateContentUpdate,
  updateContentController
);

// Delete content
router.delete("/:contentType/:contentId", protect, validateContentParams, deleteContentController);

export default router;