import config from "../config/env.js";

/**
 * Standard pagination format used across the project:
 * { page, limit, total, pages, hasNext, hasPrev }
 */

/**
 * Get pagination parameters from request
 */
export const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    config.pagination.maxPageSize,
    Math.max(
      1,
      parseInt(req.query.limit, 10) || config.pagination.defaultPageSize
    )
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Build standard pagination metadata (use everywhere for consistency)
 * @param {number} total - Total item count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {{ page, limit, total, pages, hasNext, hasPrev }}
 */
export const getPaginationMeta = (total, page, limit) => {
  const pages = Math.ceil(total / limit) || 0;
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
};
