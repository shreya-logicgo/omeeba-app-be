/**
 * Comment Report Validators
 * Joi schemas for comment report requests
 */

import Joi from "joi";
import { createSchema, commonValidations } from "../utils/validation.js";

/**
 * Schema for reporting a comment
 */
export const reportCommentBodySchema = createSchema(
  {
    subCategoryId: commonValidations.objectId.label("Sub-Category ID"),
    details: commonValidations.stringOptional(0, 280).label("Details"),
  },
  ["subCategoryId", "details"]
);

export default {
  reportCommentBodySchema,
};
