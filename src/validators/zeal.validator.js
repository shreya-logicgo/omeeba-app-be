/**
 * Zeal Validators
 * Joi validation schemas for Zeal endpoints
 */

import Joi from "joi";
import { commonValidations, createSchema } from "../utils/validation.js";

/**
 * Start Zeal Upload validation schema
 */
export const startZealUploadSchema = createSchema(
  {
    fileType: Joi.string()
      .valid("video", "image")
      .required()
      .messages({
        "any.only": "must be either 'video' or 'image'",
        "any.required": "is required",
      })
      .label("File Type"),
    fileName: commonValidations.stringRequired(1, 255).label("File Name"),
    fileSize: Joi.number()
      .integer()
      .positive()
      .required()
      .messages({
        "number.base": "must be a valid number",
        "number.positive": "must be a positive number",
        "any.required": "is required",
      })
      .label("File Size"),
    mimeType: commonValidations.stringRequired(1, 100).label("MIME Type"),
  },
  ["fileType", "fileName", "fileSize", "mimeType"]
);

/**
 * Create Zeal validation schema
 */
export const createZealSchema = createSchema(
  {
    zealDraftId: commonValidations.objectId.label("Zeal Draft ID"),
    caption: commonValidations.stringOptional(0, 2000).label("Caption"),
    mentionedUserIds: commonValidations.arrayOptional(
      commonValidations.objectId
    ).label("Mentioned User IDs"),
    musicId: commonValidations.objectIdOptional.label("Music ID"),
    musicStartTime: Joi.number()
      .min(0)
      .allow(null)
      .optional()
      .messages({
        "number.base": "must be a valid number",
        "number.min": "must be 0 or greater",
      })
      .label("Music Start Time"),
    musicEndTime: Joi.number()
      .min(0)
      .allow(null)
      .optional()
      .messages({
        "number.base": "must be a valid number",
        "number.min": "must be 0 or greater",
      })
      .label("Music End Time"),
    isDevelopByAi: commonValidations.boolean.label("Is Developed By AI"),
  },
  [
    "zealDraftId",
    "caption",
    "mentionedUserIds",
    "musicId",
    "musicStartTime",
    "musicEndTime",
    "isDevelopByAi",
  ]
);

/**
 * Get Zeal Status validation schema (params)
 */
export const getZealStatusParamsSchema = createSchema(
  {
    zealId: commonValidations.objectId.label("Zeal ID"),
  },
  ["zealId"]
);

export default {
  startZealUploadSchema,
  createZealSchema,
  getZealStatusParamsSchema,
};

