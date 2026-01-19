/**
 * Zeal Controller
 * Handles Zeal-related HTTP requests
 */

import {
  startZealUpload,
  createZeal,
  getZealStatus,
} from "../services/zeal.service.js";
import { uploadFileWithChunking } from "../services/zeal-upload.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Start Zeal Upload
 * @route POST /api/v1/zeals/start
 * @access Private
 */
export const startUpload = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const fileData = req.body;

    // Start upload process
    const result = await startZealUpload(userId, fileData);

    return sendSuccess(
      res,
      result,
      "Pre-signed upload URL generated successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Start Zeal Upload error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to start Zeal upload",
      "Upload Error",
      error.message || "An error occurred while starting upload",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Create Zeal Post
 * @route POST /api/v1/zeals
 * @access Private
 */
export const create = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { zealDraftId, ...zealData } = req.body;

    if (!zealDraftId) {
      return sendBadRequest(res, "Zeal Draft ID is required");
    }

    // Create Zeal post
    const zealPost = await createZeal(userId, zealDraftId, zealData);

    return sendSuccess(
      res,
      {
        zealId: zealPost._id.toString(),
        status: zealPost.status,
        createdAt: zealPost.createdAt,
      },
      "Zeal post created successfully. Processing in progress.",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("Create Zeal error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to create Zeal post",
      "Creation Error",
      error.message || "An error occurred while creating Zeal post",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Zeal Status
 * @route GET /api/v1/zeals/:zealId/status
 * @access Private
 */
export const getStatus = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { zealId } = req.params;

    // Get Zeal status
    const status = await getZealStatus(userId, zealId);

    return sendSuccess(
      res,
      status,
      "Zeal status retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get Zeal Status error:", error);

    // Handle not found errors
    if (error.message && error.message.includes("not found")) {
      return sendNotFound(res, error.message);
    }

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to get Zeal status",
      "Status Error",
      error.message || "An error occurred while retrieving Zeal status",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};


/**
 * Upload File (Server-side chunking)
 * @route POST /api/v1/zeals/upload
 * @access Private
 */
export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return sendBadRequest(res, "No file uploaded");
    }

    const userId = req.user._id.toString();

    // Upload file with automatic chunking in background
    const result = await uploadFileWithChunking(userId, req.file);

    return sendSuccess(
      res,
      result,
      result.message || "File upload started successfully",
      StatusCodes.CREATED
    );
  } catch (error) {
    logger.error("File Upload error:", error);

    // Cleanup uploaded file if exists
    if (req.file && req.file.path) {
      try {
        const fs = await import("fs");
        await fs.promises.unlink(req.file.path);
      } catch (unlinkError) {
        logger.warn(`Error deleting uploaded file: ${unlinkError}`);
      }
    }

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to upload file",
      "Upload Error",
      error.message || "An error occurred while uploading file",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  startUpload,
  create,
  getStatus,
  uploadFile,
};

