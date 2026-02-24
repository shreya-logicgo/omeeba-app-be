// validators/content.validator.ts
import Joi from "joi";
import { ContentType, ZealStatus, PollStatus } from "../models/enums.js";

// Friendly names users might send
const friendlyContentTypes = ["Post", "Write Post", "Zeal Post", "Poll"];

// Map friendly names (with or without spaces) to internal enums
const contentTypeMap = {
  "Post": ContentType.POST,
  "WritePost": ContentType.WRITE_POST,     // no-space alias
  "Write Post": ContentType.WRITE_POST,
  "ZealPost": ContentType.ZEAL,           // no-space alias
  "Zeal Post": ContentType.ZEAL,
  "Poll": ContentType.POLL,
};

// -------------------------
// Validate params
// -------------------------
export const validateContentParams = (req, res, next) => {
  let { contentType, contentId } = req.params;

  // Normalize: remove spaces and decode
  contentType = decodeURIComponent(contentType).replace(/\s+/g, '').trim();

  // Step 1: Validate against no-space friendly names
  const schema = Joi.object({
    contentType: Joi.string()
      .valid("Post", "WritePost", "ZealPost", "Poll")
      .required(),
    contentId: Joi.string().length(24).hex().required(),
  });

  const { error } = schema.validate({ contentType, contentId });
  if (error) return res.status(400).json({ message: error.details[0].message });

  // Step 2: Map normalized friendly name to enum
  req.params.contentType = contentTypeMap[contentType];

  next();
};

// -------------------------
// Update body schemas
// -------------------------
const postUpdateSchema = Joi.object({
  caption: Joi.string().optional(),
  images: Joi.array().items(Joi.string()).optional(),
  mentionedUserIds: Joi.array()
    .items(Joi.string().length(24).hex())
    .optional(),
  musicId: Joi.string().length(24).hex().optional(),
  musicStartTime: Joi.number().optional(),
  musicEndTime: Joi.number().optional(),
}).min(1);

const writePostUpdateSchema = Joi.object({
  content: Joi.string().optional(),
  mentionedUserIds: Joi.array()
    .items(Joi.string().length(24).hex())
    .optional(),
}).min(1);

const zealUpdateSchema = Joi.object({
  caption: Joi.string().optional(),
  videos: Joi.array().items(Joi.string()).optional(),
  images: Joi.array().items(Joi.string()).optional(),
  mentionedUserIds: Joi.array()
    .items(Joi.string().length(24).hex())
    .optional(),
  musicId: Joi.string().length(24).hex().optional(),
  musicStartTime: Joi.number().optional(),
  musicEndTime: Joi.number().optional(),
  status: Joi.string().valid(...Object.values(ZealStatus)).optional(),
  isDevelopByAi: Joi.boolean().optional(),
}).min(1);

const pollUpdateSchema = Joi.object({
  caption: Joi.string().optional(),
  options: Joi.array().items(
    Joi.object({
      optionId: Joi.string().required(),
      optionText: Joi.string().required(),
    })
  ).optional(),
  duration: Joi.date().optional(),
  status: Joi.string().valid(...Object.values(PollStatus)).optional(),
}).min(1);

// -------------------------
// Validate update body dynamically based on contentType
// -------------------------
export const validateContentUpdate = (req, res, next) => {
  const { contentType } = req.params;

  let schema;
  switch (contentType) {
    case ContentType.POST:
      schema = postUpdateSchema;
      break;
    case ContentType.WRITE_POST:
      schema = writePostUpdateSchema;
      break;
    case ContentType.ZEAL:
      schema = zealUpdateSchema;
      break;
    case ContentType.POLL:
      schema = pollUpdateSchema;
      break;
    default:
      return res.status(400).json({ message: "Invalid contentType" });
  }

  const { error } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  next();
};