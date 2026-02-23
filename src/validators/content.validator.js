import Joi from "joi";
import { ContentType, ZealStatus, PollStatus } from "../models/enums.js";

const friendlyContentTypes = ["Post", "Write Post", "Zeal Post", "Poll"];
const contentTypeMap = {
  "Post": ContentType.POST,
  "Write Post": ContentType.WRITE_POST,
  "Zeal Post": ContentType.ZEAL,
  "Poll": ContentType.POLL,
};

export const validateContentParams = (req, res, next) => {
  let { contentType, contentId } = req.params;

  contentType = decodeURIComponent(contentType).trim();

  // Step 1: Validate against friendly names
  const schema = Joi.object({
    contentType: Joi.string()
      .valid(...friendlyContentTypes)
      .required(),
    contentId: Joi.string().length(24).hex().required(),
  });

  const { error } = schema.validate({ contentType, contentId });
  if (error) return res.status(400).json({ message: error.details[0].message });

  // Step 2: Map friendly name to enum for internal use
  req.params.contentType = contentTypeMap[contentType];

  next();
};

// -------------------------
// Update body schemas
// -------------------------
const postUpdateSchema = Joi.object({
  caption: Joi.string().optional(),
  images: Joi.array().items(Joi.string()).optional(),
  musicId: Joi.string().length(24).hex().optional(),
  musicStartTime: Joi.number().optional(),
  musicEndTime: Joi.number().optional(),
}).min(1);

const writePostUpdateSchema = Joi.object({
  content: Joi.string().optional(),
}).min(1);

const zealUpdateSchema = Joi.object({
  caption: Joi.string().optional(),
  videos: Joi.array().items(Joi.string()).optional(),
  images: Joi.array().items(Joi.string()).optional(),
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

/**
 * Validate update body dynamically based on contentType
 */
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