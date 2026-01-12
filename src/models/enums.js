// =======================
// ENUMS
// =======================

const ContentType = {
  POST: "post",
  WRITE_POST: "write_post",
  ZEAL: "zeal",
};

// Content Model Names (for refPath in Mongoose)
const ContentModelName = {
  POST: "Post",
  WRITE_POST: "WritePost",
  ZEAL: "ZealPost",
};

// Mapping from ContentType to Model Name
const ContentTypeToModelName = {
  [ContentType.POST]: ContentModelName.POST,
  [ContentType.WRITE_POST]: ContentModelName.WRITE_POST,
  [ContentType.ZEAL]: ContentModelName.ZEAL,
};

const ReportStatus = {
  PENDING: "pending",
  REVIEWED: "reviewed",
  RESOLVED: "resolved",
};

const PollStatus = {
  ACTIVE: "active",
  EXPIRED: "expired",
};

const SubscriptionStatus = {
  ACTIVE: "active",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  PENDING: "pending",
};

const BillingCycle = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  YEARLY: "yearly",
};

const NotificationType = {
  POST_COMMENT: "post_comment",
  COMMENT_REPLY: "comment_reply",
  POST_LIKE: "post_like",
  COMMENT_LIKE: "comment_like",
  FOLLOW: "follow",
};

const NotificationStatus = {
  UNREAD: "unread",
  READ: "read",
};

const ChatType = {
  DIRECT: "direct",
  REQUEST: "request",
};

const MessageType = {
  TEXT: "text",
  IMAGE: "image",
  SNAP: "snap",
  POST: "post",
  WRITE_POST: "write_post",
  ZEAL: "zeal",
};

const MessageStatus = {
  SENT: "sent",
  DELIVERED: "delivered",
  SEEN: "seen",
};

export {
  ContentType,
  ContentModelName,
  ContentTypeToModelName,
  ReportStatus,
  PollStatus,
  SubscriptionStatus,
  BillingCycle,
  NotificationType,
  NotificationStatus,
  ChatType,
  MessageType,
  MessageStatus,
};
