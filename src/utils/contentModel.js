import ZealPost from "../models/content/ZealPost.js";
import WritePost from "../models/content/WritePost.js";
import Post from "../models/content/Post.js";
import Poll from "../models/content/Poll.js";
import { ContentType } from "../models/enums.js";

// Map friendly names or enums to models
const contentModelMap = {
  [ContentType.POST]: Post,
  [ContentType.WRITE_POST]: WritePost,
  [ContentType.ZEAL]: ZealPost,
  [ContentType.POLL]: Poll,
};

export const getContentModel = (contentType) => {
  const Model = contentModelMap[contentType];
  if (!Model) throw new Error("Invalid content type");
  return Model;
};