// =======================
// CONTENT HELPER UTILITIES
// =======================
// Helper functions to work with polymorphic content references

import {
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
} from "../enums.js";
import Post from "../content/Post.js";
import WritePost from "../content/WritePost.js";
import ZealPost from "../content/ZealPost.js";
import Poll from "../content/Poll.js";

/**
 * Get the Mongoose model based on contentType
 * @param {string} contentType - Content type (post, write_post, zeal, poll)
 * @returns {Model|null} - Mongoose model or null if not found
 */
export const getContentModel = (contentType) => {
  const modelMap = {
    [ContentType.POST]: Post,
    [ContentType.WRITE_POST]: WritePost,
    [ContentType.ZEAL]: ZealPost,
    poll: Poll,
  };

  return modelMap[contentType] || null;
};

/**
 * Get the model name string based on contentType
 * @param {string} contentType - Content type (post, write_post, zeal)
 * @returns {string|null} - Model name (Post, WritePost, ZealPost) or null
 */
export const getContentModelName = (contentType) => {
  return ContentTypeToModelName[contentType] || null;
};

/**
 * Populate content based on contentType and contentId
 * @param {Object} doc - Document with contentType and contentId
 * @param {string} select - Fields to select (optional)
 * @returns {Promise<Object>} - Populated content document
 */
export const populateContent = async (doc, select = null) => {
  if (!doc.contentType || !doc.contentId) {
    return null;
  }

  const Model = getContentModel(doc.contentType);
  if (!Model) {
    return null;
  }

  const query = Model.findById(doc.contentId);
  if (select) {
    query.select(select);
  }

  return await query.exec();
};

/**
 * Validate if contentId exists for given contentType
 * @param {string} contentType - Content type
 * @param {mongoose.Types.ObjectId} contentId - Content ID
 * @returns {Promise<boolean>} - True if content exists
 */
export const validateContentExists = async (contentType, contentId) => {
  const Model = getContentModel(contentType);
  if (!Model) {
    return false;
  }

  const content = await Model.findById(contentId);
  return content !== null;
};

export default {
  getContentModel,
  getContentModelName,
  populateContent,
  validateContentExists,
};
