// controllers/content.controller.js
import { getSingleContent, updateContent, deleteContent } from "../services/content.service.js";
import { sendSuccess, sendBadRequest } from "../utils/response.js";
import logger from "../utils/logger.js";

/**
 * GET single content
 * @route GET /api/v1/content/:contentType/:contentId
 */
export const getContentController = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const content = await getSingleContent(contentType, contentId);
    return sendSuccess(res, { content }, `${contentType} fetched successfully`);
  } catch (error) {
    logger.error("Get content error:", error);
    return sendBadRequest(res, error.message);
  }
};

/**
 * UPDATE content
 * @route PUT /api/v1/content/:contentType/:contentId
 */
export const updateContentController = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    const updateData = req.body;
    const content = await updateContent(contentType, contentId, req.user._id, updateData);
    return sendSuccess(res, { content }, `${contentType} updated successfully`);
    
  } catch (error) {
    logger.error("Update content error:", error);
    return sendBadRequest(res, error.message);
  }
};

export const deleteContentController = async (req, res) => {
  try {
    const { contentType, contentId } = req.params;
    await deleteContent(contentType, contentId, req.user._id);
    return sendSuccess(res, {}, `${contentType} deleted successfully`);
  } catch (error) {
    logger.error("Delete content error:", error);
    return sendBadRequest(res, error.message);
  }
};