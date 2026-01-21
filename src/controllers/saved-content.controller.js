import {
  toggleSaveContent,
  saveContent,
  unsaveContent,
  getContentSavedStatus,
} from "../services/saved-content.service.js";
import {
  sendSuccess,
  sendError,
  sendBadRequest,
  sendNotFound,
} from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import mongoose from "mongoose";
import { ContentType } from "../models/enums.js";

/**
 * Toggle save status (save if not saved, unsave if saved)
 * @route POST /api/v1/saved-content/toggle
 * @access Private
 * @body { contentType: string, contentId: string }
 */
export const toggle = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contentType, contentId } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate content ID
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);

    // Toggle save
    const result = await toggleSaveContent(userId, contentType, contentObjectId);

    return sendSuccess(
      res,
      {
        action: result.action,
        isSaved: result.isSaved,
        contentType,
        contentId,
      },
      result.action === "saved"
        ? "Content saved successfully"
        : result.action === "unsaved"
        ? "Content unsaved successfully"
        : "Content already saved",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Toggle save error:", error);

    // Handle specific errors
    if (error.message === "Content not found or not accessible") {
      return sendNotFound(res, error.message);
    }

    if (error.message === "Invalid content type") {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to toggle save",
      "Toggle Save Error",
      error.message || "An error occurred while toggling save",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Save content
 * @route POST /api/v1/saved-content/save
 * @access Private
 * @body { contentType: string, contentId: string }
 */
export const save = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contentType, contentId } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate content ID
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);

    // Save content
    const result = await saveContent(userId, contentType, contentObjectId);

    return sendSuccess(
      res,
      {
        action: result.action,
        isSaved: result.isSaved,
        contentType,
        contentId,
      },
      result.action === "saved"
        ? "Content saved successfully"
        : "Content already saved",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Save content error:", error);

    // Handle specific errors
    if (error.message === "Content not found or not accessible") {
      return sendNotFound(res, error.message);
    }

    if (error.message === "Invalid content type") {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to save content",
      "Save Content Error",
      error.message || "An error occurred while saving content",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Unsave content
 * @route POST /api/v1/saved-content/unsave
 * @access Private
 * @body { contentType: string, contentId: string }
 */
export const unsave = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contentType, contentId } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate content ID
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);

    // Unsave content
    const result = await unsaveContent(userId, contentType, contentObjectId);

    return sendSuccess(
      res,
      {
        action: result.action,
        isSaved: result.isSaved,
        contentType,
        contentId,
      },
      result.action === "unsaved"
        ? "Content unsaved successfully"
        : "Content is not saved",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Unsave content error:", error);

    // Handle specific errors
    if (error.message === "Content not found or not accessible") {
      return sendNotFound(res, error.message);
    }

    if (error.message === "Invalid content type") {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to unsave content",
      "Unsave Content Error",
      error.message || "An error occurred while unsaving content",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * Get saved status for content
 * @route POST /api/v1/saved-content/status
 * @access Private
 */
export const getStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { contentType, contentId } = req.body;

    // Validate content type
    if (!Object.values(ContentType).includes(contentType)) {
      return sendBadRequest(res, "Invalid content type");
    }

    // Validate content ID
    if (!mongoose.Types.ObjectId.isValid(contentId)) {
      return sendBadRequest(res, "Invalid content ID");
    }

    const contentObjectId = new mongoose.Types.ObjectId(contentId);

    // Get saved status
    const result = await getContentSavedStatus(
      userId,
      contentType,
      contentObjectId
    );

    return sendSuccess(
      res,
      {
        isSaved: result.isSaved,
        contentType,
        contentId,
      },
      "Saved status retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get saved status error:", error);

    // Generic error
    return sendError(
      res,
      "Failed to get saved status",
      "Get Saved Status Error",
      error.message || "An error occurred while retrieving saved status",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  toggle,
  save,
  unsave,
  getStatus,
};

