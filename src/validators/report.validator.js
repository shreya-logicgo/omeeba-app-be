/**
 * Report Validators
 * Joi validation schemas for report endpoints
 */

import Joi from "joi";
import { commonValidations, createSchema } from "../utils/validation.js";
import { ContentType } from "../models/enums.js";

/**
 * Get sub-categories validation schema (params)
 */
export const getSubCategoriesParamsSchema = createSchema({
  categoryId: commonValidations.objectId.label("Category ID"),
});

/**
 * Create report validation schema (body)
 */
export const createReportBodySchema = createSchema(
  {
    contentType: Joi.string()
      .valid(...Object.values(ContentType))
      .required()
      .messages({
        "any.only": `must be one of: ${Object.values(ContentType).join(", ")}`,
        "any.required": "is required",
      })
      .label("Content Type"),
    contentId: commonValidations.objectId.label("Content ID"),
    subCategoryId: commonValidations.objectId.label("Sub-Category ID"),
    details: commonValidations.stringOptional(0, 280).label("Details"),
  },
  ["contentType", "contentId", "subCategoryId", "details"]
);

export default {
  getSubCategoriesParamsSchema,
  createReportBodySchema,
};
