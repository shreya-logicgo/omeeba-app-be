import config from "../config/env.js";

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
