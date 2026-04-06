// =======================
// ENUMS
// =======================

const ContentType = {
  POST: "Post",
  WRITE_POST: "Write Post",
  ZEAL: "Zeal Post",
  POLL: "Poll",
};

// Content Model Names (for refPath in Mongoose)
const ContentModelName = {
  POST: "Post",
  WRITE_POST: "Write Post",
  ZEAL: "Zeal Post",
  POLL: "Poll",
};

// Mapping from ContentType to Model Name
const ContentTypeToModelName = {
  [ContentType.POST]: ContentModelName.POST,
  [ContentType.WRITE_POST]: ContentModelName.WRITE_POST,
  [ContentType.ZEAL]: ContentModelName.ZEAL,
  [ContentType.POLL]: ContentModelName.POLL,
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
  // Follow & User Activity
  NEW_FOLLOWER: "New Follower",
  FOLLOW_REQUEST: "Follow Request",
  FOLLOW_REQUEST_ACCEPTED: "Follow Request Accepted",
  
  // Likes
  POST_LIKED: "Post Liked",
  ZEAL_LIKED: "Zeal Liked",
  WRITE_LIKED: "Write Liked",
  POLL_LIKED: "Poll Liked",
  COMMENT_LIKED: "Comment Liked",
  AGGREGATED_LIKES: "Aggregated Likes",
  
  // Comments & Replies
  POST_COMMENT: "Post Comment",
  ZEAL_COMMENT: "Zeal Comment",
  WRITE_COMMENT: "Write Comment",
  POLL_COMMENT: "Poll Comment",
  COMMENT_REPLY: "Comment Reply",
  MENTION_IN_COMMENT: "Mention In Comment",
  
  // Mentions
  MENTION_IN_POST: "Mention In Post",
  MENTION_IN_ZEAL: "Mention In Zeal",
  MENTION_IN_WRITE: "Mention In Write",
  
  // Tag Notifications
  TAG: "Tag",
  
  // Shares
  CONTENT_SHARED: "Content Shared",
  CONTENT_SHARED_WITH_YOU: "Content Shared With You",
  
  // Byte Opened
  NEW_SNAP_RECEIVED: "New Snap Received",
  NEW_BYTE_OPENED_RECEIVED: "New Byte Opened Received",
  BYTE_OPENED_VIEWED: "Byte Opened Viewed",
  
  // Polls
  POLL_VOTED: "Poll Voted",
  POLL_ENDED: "Poll Ended",
  
  // System & Account
  VERIFIED_BADGE_ACTIVATED: "Verified Badge Activated",
  VERIFIED_BADGE_EXPIRED: "Verified Badge Expired",
  SUBSCRIPTION_PAYMENT_SUCCESS: "Subscription Payment Success",
  
  // Moderation & Safety
  CONTENT_REPORTED: "Content Reported",
  MODERATION_ACTION: "Moderation Action",

  // Chat
  NEW_MESSAGE: "New Message Received",
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
  POLL: "Poll",
};

const MessageStatus = {
  SENT: "Sent",
  DELIVERED: "Delivered",
  SEEN: "Seen",
};

const ZealStatus = {
  DRAFT: "draft",
  PROCESSING: "processing",
  ACTION_REQUIRED: "action_required",
  READY: "ready",
  PUBLISHED: "published",
  FAILED: "failed",
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
  ZealStatus,
};
