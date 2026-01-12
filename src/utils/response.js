import { StatusCodes } from "http-status-codes";

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
export const sendSuccess = (res, data, message = "Success", statusCode = StatusCodes.OK) => {
  res.status(statusCode).json({
    success: true,
    message,
    data: data !== undefined ? data : null,
  });
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {string} errorType - Type of error (e.g., "Server Error", "Validation Error")
 * @param {string} error - Detailed error message
 * @param {number} statusCode - HTTP status code
 */
export const sendError = (
  res,
  message = "Internal Server Error",
  errorType = "Server Error",
  error = "Internal Server Error",
  statusCode = StatusCodes.INTERNAL_SERVER_ERROR
) => {
  res.status(statusCode).json({
    success: false,
    message,
    errorType,
    error,
    data: null,
  });
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {string} errorMessage - Validation error message
 * @param {number} statusCode - HTTP status code
 */
export const sendValidationError = (
  res,
  errorMessage = "Validation error",
  statusCode = StatusCodes.BAD_REQUEST
) => {
  res.status(statusCode).json({
    success: false,
    message: "Validation error",
    errorType: "Validation Error",
    error: errorMessage,
    data: null,
  });
};

/**
 * Send paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Response data array
 * @param {Object} pagination - Pagination metadata
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
export const sendPaginated = (
  res,
  data,
  pagination,
  message = "Success",
  statusCode = StatusCodes.OK
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data: data || [],
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
      hasNext: pagination.hasNext || false,
      hasPrev: pagination.hasPrev || false,
    },
  });
};

/**
 * Send not found error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export const sendNotFound = (res, message = "Resource not found") => {
  sendError(res, message, "Not Found", message, StatusCodes.NOT_FOUND);
};

/**
 * Send unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export const sendUnauthorized = (res, message = "Unauthorized") => {
  sendError(res, message, "Unauthorized", message, StatusCodes.UNAUTHORIZED);
};

/**
 * Send forbidden error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export const sendForbidden = (res, message = "Forbidden") => {
  sendError(res, message, "Forbidden", message, StatusCodes.FORBIDDEN);
};

/**
 * Send bad request error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 */
export const sendBadRequest = (res, message = "Bad Request") => {
  sendError(res, message, "Bad Request", message, StatusCodes.BAD_REQUEST);
};
