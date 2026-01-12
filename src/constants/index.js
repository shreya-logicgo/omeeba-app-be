// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

// User Roles
export const USER_ROLES = {
  USER: "user",
  ADMIN: "admin",
  MODERATOR: "moderator",
};

// Content Types
export const CONTENT_TYPES = {
  POST: "post",
  WRITE_POST: "write_post",
  ZEAL: "zeal",
  POLL: "poll",
};

// Notification Types
export const NOTIFICATION_TYPES = {
  POST_COMMENT: "post_comment",
  COMMENT_REPLY: "comment_reply",
  POST_LIKE: "post_like",
  COMMENT_LIKE: "comment_like",
  FOLLOW: "follow",
};

// Message Types
export const MESSAGE_TYPES = {
  TEXT: "text",
  IMAGE: "image",
  SNAP: "snap",
  POST: "post",
  WRITE_POST: "write_post",
  ZEAL: "zeal",
};

// Error Messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: "Not authorized to access this route",
  NOT_FOUND: "Resource not found",
  VALIDATION_ERROR: "Validation error",
  DUPLICATE_ENTRY: "Duplicate entry",
  INTERNAL_ERROR: "Internal server error",
};

// Success Messages
export const SUCCESS_MESSAGES = {
  CREATED: "Created successfully",
  UPDATED: "Updated successfully",
  DELETED: "Deleted successfully",
  FETCHED: "Fetched successfully",
};

