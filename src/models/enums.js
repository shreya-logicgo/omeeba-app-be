// =======================
// ENUMS
// =======================

const ContentType = {
  POST: "Post",
  WRITE_POST: "Write Post",
  ZEAL: "Zeal Post",
};

// Content Model Names (for refPath in Mongoose)
const ContentModelName = {
  POST: "Post",
  WRITE_POST: "Write Post",
  ZEAL: "Zeal Post",
};

// Mapping from ContentType to Model Name
const ContentTypeToModelName = {
  [ContentType.POST]: ContentModelName.POST,
  [ContentType.WRITE_POST]: ContentModelName.WRITE_POST,
  [ContentType.ZEAL]: ContentModelName.ZEAL,
};

const ReportStatus = {
  PENDING: "Pending",
  REVIEWED: "Reviewed",
  RESOLVED: "Resolved",
};

const PollStatus = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
};

const SubscriptionStatus = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  PENDING: "Pending",
};

const BillingCycle = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
};

const NotificationType = {
  POST_COMMENT: "Post Comment",
  COMMENT_REPLY: "Comment Reply",
  POST_LIKE: "Post Like",
  COMMENT_LIKE: "Comment Like",
  FOLLOW: "Follow",
};

const NotificationStatus = {
  UNREAD: "Unread",
  READ: "Read",
};

const ChatType = {
  DIRECT: "Direct",
  REQUEST: "Request",
};

const MessageType = {
  TEXT: "Text",
  IMAGE: "Image",
  SNAP: "Snap",
  POST: "Post",
  WRITE_POST: "Write Post",
  ZEAL: "Zeal",
};

const MessageStatus = {
  SENT: "Sent",
  DELIVERED: "Delivered",
  SEEN: "Seen",
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
