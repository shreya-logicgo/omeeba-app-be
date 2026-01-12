import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { sendError, sendValidationError } from "../utils/response.js";

/**
 * 404 Not Found handler
 */
export const notFound = (req, res, _next) => {
  sendError(
    res,
    `Not Found - ${req.originalUrl}`,
    "Not Found",
    `Route ${req.originalUrl} not found`,
    StatusCodes.NOT_FOUND
  );
};

/**
 * Global error handler
 */
export const errorHandler = (err, req, res, _next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || "Internal Server Error";
  let errorType = "Server Error";

  // Mongoose bad ObjectId
  if (err.name === "CastError") {
    message = "Resource not found";
    errorType = "Not Found";
    statusCode = StatusCodes.NOT_FOUND;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    errorType = "Duplicate Entry";
    statusCode = StatusCodes.CONFLICT;
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    message = errors;
    errorType = "Validation Error";
    statusCode = StatusCodes.BAD_REQUEST;
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    message = "Invalid token";
    errorType = "Unauthorized";
    statusCode = StatusCodes.UNAUTHORIZED;
  }

  if (err.name === "TokenExpiredError") {
    message = "Token expired";
    errorType = "Unauthorized";
    statusCode = StatusCodes.UNAUTHORIZED;
  }

  // Joi validation errors
  if (err.isJoi) {
    const errorMessage = err.details
      .map((detail) => {
        const field = detail.path.join(".");
        const msg = detail.message.replace(/"/g, "");
        return `${field.charAt(0).toUpperCase() + field.slice(1)} ${msg}`;
      })
      .join(", ");
    return sendValidationError(res, errorMessage, statusCode);
  }

  // Log error
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  // Send error response
  sendError(res, message, errorType, message, statusCode);
};
