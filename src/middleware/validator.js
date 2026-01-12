import { validateBody, validateQuery, validateParams } from "../utils/validation.js";

/**
 * Re-export validation functions for convenience
 */
export { validateBody, validateQuery, validateParams };

/**
 * Validate request - Check for express-validator errors (legacy support)
 * This is kept for backward compatibility if using express-validator
 */
import { validationResult } from "express-validator";
import { StatusCodes } from "http-status-codes";
import { sendValidationError } from "../utils/response.js";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessage = errors
      .array()
      .map((err) => `${err.param || err.msg}: ${err.msg}`)
      .join(", ");
    return sendValidationError(res, errorMessage, StatusCodes.BAD_REQUEST);
  }
  next();
};
