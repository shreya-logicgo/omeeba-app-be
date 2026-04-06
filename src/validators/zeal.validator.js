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
    caption: commonValidations.stringOptional(0, 1000).label("Caption"),
    mentionedUserIds: Joi.array()
      .items(
        Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .messages({
            "string.pattern.base": "must be a valid ObjectId",
          })
      )
      .min(0)
      .optional()
      .default([])
      .label("Mentioned User IDs"),
    musicId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .when("audioAction", {
        is: "replace",
        then: Joi.required(),
        otherwise: Joi.when("audioAction", {
          is: Joi.valid("mute", "original"),
          then: Joi.forbidden(),
          otherwise: Joi.optional().allow(null),
        }),
      })
      .messages({
        "string.pattern.base": "must be a valid ObjectId",
        "any.required": "is required when audioAction is 'replace'",
        "any.unknown": "must not be sent when audioAction is 'mute' or 'original'",
      })
      .label("Music ID"),
    musicStartTime: Joi.number()
      .min(0)
      .allow(null)
      .when("audioAction", {
        is: "replace",
        then: Joi.required(),
        otherwise: Joi.when("audioAction", {
          is: Joi.valid("mute", "original"),
          then: Joi.forbidden(),
          otherwise: Joi.optional(),
        }),
      })
      .messages({
        "number.base": "must be a valid number",
        "number.min": "must be 0 or greater",
        "any.required": "is required when audioAction is 'replace'",
        "any.unknown": "must not be sent when audioAction is 'mute' or 'original'",
      })
      .label("Music Start Time"),
    musicEndTime: Joi.number()
      .min(0)
      .allow(null)
      .when("audioAction", {
        is: "replace",
        then: Joi.required(),
        otherwise: Joi.when("audioAction", {
          is: Joi.valid("mute", "original"),
          then: Joi.forbidden(),
          otherwise: Joi.optional(),
        }),
      })
      .messages({
        "number.base": "must be a valid number",
        "number.min": "must be 0 or greater",
        "any.required": "is required when audioAction is 'replace'",
        "any.unknown": "must not be sent when audioAction is 'mute' or 'original'",
      })
      .label("Music End Time"),
    isDevelopByAi: commonValidations.boolean.label("Is Developed By AI"),
    audioAction: Joi.string()
      .valid("original", "mute", "replace")
      .optional()
      .default("original") // Added default
      .allow(null)
      .label("Audio Action"),
  },
  [
    "zealDraftId",
    "caption",
    "mentionedUserIds",
    "musicId",
    "musicStartTime",
    "musicEndTime",
    "isDevelopByAi",
    "audioAction",
  ]
);

/**
 * Handle Audio Action validation schema
 */
export const handleAudioActionSchema = createSchema(
  {
    action: Joi.string()
      .valid("original", "mute", "replace")
      .required()
      .messages({
        "any.only": "must be one of 'original', 'mute', 'replace'",
        "any.required": "is required",
      })
      .label("Action"),
    musicId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .when("action", {
        is: "replace",
        then: Joi.required(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "string.pattern.base": "must be a valid ObjectId",
        "any.required": "is required when action is 'replace'",
        "any.unknown": "must not be sent when action is 'mute' or 'original'",
      })
      .label("Music ID"),
    musicStartTime: Joi.number()
      .min(0)
      .allow(null)
      .when("action", {
        is: "replace",
        then: Joi.optional(), // Start time is optional even in replace
        otherwise: Joi.forbidden(),
      })
      .messages({
        "any.unknown": "must not be sent when action is 'mute' or 'original'",
      })
      .label("Music Start Time"),
    musicEndTime: Joi.number()
      .min(0)
      .allow(null)
      .when("action", {
        is: "replace",
        then: Joi.optional(),
        otherwise: Joi.forbidden(),
      })
      .messages({
        "any.unknown": "must not be sent when action is 'mute' or 'original'",
      })
      .label("Music End Time"),
  },
  ["action", "musicId", "musicStartTime", "musicEndTime"]
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

/**
 * Delete Zeal - params (zealId)
 */
export const deleteZealParamsSchema = createSchema(
  { zealId: commonValidations.objectId.label("Zeal ID") },
  ["zealId"]
);

export default {
  startZealUploadSchema,
  createZealSchema,
  handleAudioActionSchema,
  getZealStatusParamsSchema,
  deleteZealParamsSchema,
};


