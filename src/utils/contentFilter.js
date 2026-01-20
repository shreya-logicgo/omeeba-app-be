/**
 * Content Filter Utilities
 * Utilities to filter out reported content for users
 */

import { ContentReport } from "../models/index.js";
import { ContentType } from "../models/enums.js";

/**
 * Get all reported content IDs for a user, grouped by content type
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Object with contentType as keys and arrays of contentIds as values
 * Example: { "Post": ["id1", "id2"], "Write Post": ["id3"], "Zeal Post": [] }
 */
export const getReportedContentIds = async (userId) => {
  try {
    const reports = await ContentReport.find({
      reportedBy: userId,
    })
      .select("contentType contentId")
      .lean();

    // Group by contentType
    const reportedContent = {
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
    };

    reports.forEach((report) => {
      if (reportedContent[report.contentType]) {
        reportedContent[report.contentType].push(
          report.contentId.toString()
        );
      }
    });

    return reportedContent;
  } catch (error) {
    console.error("Error getting reported content IDs:", error);
    // Return empty object on error to prevent breaking queries
    return {
      [ContentType.POST]: [],
      [ContentType.WRITE_POST]: [],
      [ContentType.ZEAL]: [],
    };
  }
};

/**
 * Get reported content IDs for a specific content type
 * @param {string} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
 * @returns {Promise<Array>} Array of reported content IDs
 */
export const getReportedContentIdsByType = async (userId, contentType) => {
  try {
    const reports = await ContentReport.find({
      reportedBy: userId,
      contentType: contentType,
    })
      .select("contentId")
      .lean();

    return reports.map((report) => report.contentId.toString());
  } catch (error) {
    console.error("Error getting reported content IDs by type:", error);
    return [];
  }
};

/**
 * Check if a specific content is reported by a user
 * @param {string} userId - User ID
 * @param {string} contentType - Content type
 * @param {string} contentId - Content ID
 * @returns {Promise<boolean>} True if content is reported by user
 */
export const isContentReportedByUser = async (userId, contentType, contentId) => {
  try {
    const report = await ContentReport.findOne({
      reportedBy: userId,
      contentType: contentType,
      contentId: contentId,
    });

    return !!report;
  } catch (error) {
    console.error("Error checking if content is reported:", error);
    return false;
  }
};

/**
 * Build MongoDB query condition to exclude reported content
 * @param {string} userId - User ID
 * @param {string} contentType - Content type (Post, Write Post, Zeal Post)
 * @returns {Promise<Object>} MongoDB query condition object
 * Example: { _id: { $nin: ["id1", "id2"] } }
 */
export const getExcludeReportedContentQuery = async (userId, contentType) => {
  try {
    const reportedIds = await getReportedContentIdsByType(userId, contentType);
    
    if (reportedIds.length === 0) {
      return {}; // No reported content, return empty query (no exclusion needed)
    }

    return {
      _id: { $nin: reportedIds },
    };
  } catch (error) {
    console.error("Error building exclude reported content query:", error);
    return {}; // Return empty query on error to prevent breaking
  }
};

/**
 * Filter an array of content documents to exclude reported content
 * @param {Array} contentArray - Array of content documents
 * @param {string} userId - User ID
 * @param {string} contentType - Content type
 * @returns {Promise<Array>} Filtered array without reported content
 */
export const filterReportedContent = async (contentArray, userId, contentType) => {
  try {
    const reportedIds = await getReportedContentIdsByType(userId, contentType);
    
    if (reportedIds.length === 0) {
      return contentArray; // No reported content, return as is
    }

    const reportedIdsSet = new Set(reportedIds);
    return contentArray.filter(
      (content) => !reportedIdsSet.has(content._id.toString())
    );
  } catch (error) {
    console.error("Error filtering reported content:", error);
    return contentArray; // Return original array on error
  }
};

export default {
  getReportedContentIds,
  getReportedContentIdsByType,
  isContentReportedByUser,
  getExcludeReportedContentQuery,
  filterReportedContent,
};
