import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../config/env.js";

/**
 * Get pagination parameters from request
 */
export const getPagination = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE)
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

/**
 * Get pagination metadata
 */
export const getPaginationMeta = (total, page, limit) => {
  const pages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  };
};

