import { ContentType } from "../models/enums.js";
import { SHARE_BASE_URL } from "../config/env.js";

/**
 * Base URL for shareable links
 * Configured via environment variable SHARE_BASE_URL
 */
const BASE_SHARE_URL = SHARE_BASE_URL || "https://omeeba.app/share";

/**
 * Map ContentType enum values to URL-friendly slugs
 */
const contentTypeToSlug = {
  [ContentType.POST]: "post",
  [ContentType.WRITE_POST]: "write-post",
  [ContentType.ZEAL]: "zeal",
};

/**
 * Generate a shareable link for content
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
 * @param {string|mongoose.Types.ObjectId} contentId - Content ID
 * @returns {string} Shareable URL
 */
export const generateShareableLink = (contentType, contentId) => {
  try {
    // Convert contentId to string
    const contentIdStr = contentId.toString();

    // Get URL-friendly slug for content type
    const slug = contentTypeToSlug[contentType];

    if (!slug) {
      // Fallback: URL encode the contentType if no mapping exists
      return `${BASE_SHARE_URL}/${encodeURIComponent(contentType)}/${contentIdStr}`;
    }

    // Generate shareable link
    return `${BASE_SHARE_URL}/${slug}/${contentIdStr}`;
  } catch (error) {
    // Return a safe fallback URL
    return `${BASE_SHARE_URL}/content/${contentId}`;
  }
};

/**
 * Parse shareable link to extract contentType and contentId
 * @param {string} shareableLink - Shareable URL
 * @returns {Object|null} { contentType, contentId } or null if invalid
 */
export const parseShareableLink = (shareableLink) => {
  try {
    const url = new URL(shareableLink);
    const pathParts = url.pathname.split("/").filter((part) => part);

    if (pathParts.length < 3 || pathParts[0] !== "share") {
      return null;
    }

    const slug = pathParts[1];
    const contentId = pathParts[2];

    // Map slug back to ContentType
    const slugToContentType = {
      post: ContentType.POST,
      "write-post": ContentType.WRITE_POST,
      zeal: ContentType.ZEAL,
    };

    const contentType = slugToContentType[slug];

    if (!contentType || !contentId) {
      return null;
    }

    return {
      contentType,
      contentId,
    };
  } catch (error) {
    return null;
  }
};

export default {
  generateShareableLink,
  parseShareableLink,
};

