/**
 * Zeal Controller
 * Handles Zeal-related HTTP requests
 */

import {
  startZealUpload,
  createZeal,
  getZealStatus,
  handleZealAudioAction,
} from "../services/zeal.service.js";
import Music from "../models/music/Music.js";
import ZealDraft from "../models/content/ZealDraft.js";
import { deleteZeal as deleteZealService } from "../services/contentDeletion.service.js";
import { uploadFileWithChunking } from "../services/zeal-upload.service.js";
import { sendSuccess, sendError, sendBadRequest, sendNotFound, sendForbidden } from "../utils/response.js";
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

/**
 * Delete Zeal
 * @route DELETE /api/v1/zeals/:zealId
 * @access Private
 */
export const deleteZeal = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { zealId } = req.params;
    const result = await deleteZealService(userId, zealId);
    return sendSuccess(res, result, "Zeal deleted successfully", StatusCodes.OK);
  } catch (error) {
    logger.error("Delete zeal error:", error);
    if (error.message === "Zeal not found" || error.message === "User not found") {
      return sendNotFound(res, error.message);
    }
    if (error.message === "You can only delete your own zeals") {
      return sendForbidden(res, error.message);
    }
    if (error.message) return sendBadRequest(res, error.message);
    return sendError(
      res,
      "Failed to delete zeal",
      "Delete Zeal Error",
      error.message || "An error occurred while deleting zeal",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Handle Audio Action (User decision)
 * @route POST /api/v1/zeals/:zealId/handle-audio
 * @access Private
 */
export const handleAudioAction = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { zealId } = req.params;
    const { action, musicId, musicStartTime, musicEndTime } = req.body;

    if (!action) {
      return sendBadRequest(res, "Action is required (original, mute, replace)");
    }

    if (action === "replace" && !musicId) {
      return sendBadRequest(res, "Music ID is required for replacement");
    }

    const result = await handleZealAudioAction(userId, zealId, action, musicId, musicStartTime, musicEndTime);

    return sendSuccess(
      res,
      {
        zealId: result._id.toString(),
        status: result.status,
      },
      "Audio action registered. Processing in background.",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Handle Audio Action error:", error);
    if (error.message === "Zeal not found") return sendNotFound(res, error.message);
    if (error.message.includes("Invalid state")) return sendBadRequest(res, error.message);
    return sendError(
      res,
      "Failed to handle audio action",
      "Audio Action Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Music Library
 * @route GET /api/v1/zeals/music
 * @access Private
 */
export const getMusicLibrary = async (req, res) => {
  try {
    const { category, language, search } = req.query;
    
    let query = { isActive: true };
    if (category) query.category = category;
    if (language) query.language = language;
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const music = await Music.find(query).sort({ isTrending: -1, createdAt: -1 });

    return sendSuccess(
      res,
      music,
      "Music library retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get Music Library error:", error);
    return sendError(
      res,
      "Failed to get music library",
      "Music Library Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get Draft Audio
 * @route GET /api/v1/zeals/drafts/:draftId/audio
 * @access Private
 */
export const getDraftAudio = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { draftId } = req.params;

    const draft = await ZealDraft.findOne({ _id: draftId, userId });

    if (!draft) {
      return sendNotFound(res, "Zeal Draft not found");
    }

    if (!draft.extractedAudioUrl) {
      return sendSuccess(
        res,
        { status: "processing" },
        "Audio extraction in progress",
        StatusCodes.OK
      );
    }

    return sendSuccess(
      res,
      { audioUrl: draft.extractedAudioUrl, status: "ready" },
      "Extracted audio retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get Draft Audio error:", error);
    return sendError(
      res,
      "Failed to get draft audio",
      "Audio Error",
      error.message,
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  startUpload,
  create,
  getStatus,
  uploadFile,
  deleteZeal,
  handleAudioAction,
  getMusicLibrary,
  getDraftAudio,
};

