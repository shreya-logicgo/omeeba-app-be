/**
 * Comment Filter Utilities
 * Utilities to filter out reported comments for users
 */

import { CommentReport } from "../models/index.js";

/**
 * Get all reported comment IDs for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of reported comment IDs
 */
export const getReportedCommentIds = async (userId) => {
  try {
    const reports = await CommentReport.find({
      reportedBy: userId,
    })
      .select("commentId")
      .lean();

    return reports.map((report) => report.commentId.toString());
  } catch (error) {
    console.error("Error getting reported comment IDs:", error);
    return [];
  }
};

/**
 * Check if a specific comment is reported by a user
 * @param {string} userId - User ID
 * @param {string} commentId - Comment ID
 * @returns {Promise<boolean>} True if comment is reported by user
 */
export const isCommentReportedByUser = async (userId, commentId) => {
  try {
    const report = await CommentReport.findOne({
      reportedBy: userId,
      commentId: commentId,
    });

    return !!report;
  } catch (error) {
    console.error("Error checking if comment is reported:", error);
    return false;
  }
};

/**
 * Get reported comment IDs for multiple comments
 * @param {string} userId - User ID
 * @param {Array<string>} commentIds - Array of comment IDs
 * @returns {Promise<Set>} Set of reported comment IDs
 */
export const getReportedCommentIdsSet = async (userId, commentIds) => {
  try {
    if (!commentIds || commentIds.length === 0) {
      return new Set();
    }

    const reports = await CommentReport.find({
      reportedBy: userId,
      commentId: { $in: commentIds },
    })
      .select("commentId")
      .lean();

    return new Set(reports.map((report) => report.commentId.toString()));
  } catch (error) {
    console.error("Error getting reported comment IDs set:", error);
    return new Set();
  }
};

export default {
  getReportedCommentIds,
  isCommentReportedByUser,
  getReportedCommentIdsSet,
};
