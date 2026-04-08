/**
 * Chat Message Service
 * Business logic for chat message operations
 */

import mongoose from "mongoose";
import ChatMessage from "../models/chat/ChatMessage.js";
import ChatRoom from "../models/chat/ChatRoom.js";
import ChatParticipant from "../models/chat/ChatParticipant.js";
import User from "../models/users/User.js";
import Post from "../models/content/Post.js";
import WritePost from "../models/content/WritePost.js";
import ZealPost from "../models/content/ZealPost.js";
import Poll from "../models/content/Poll.js";
import { MessageType, MessageStatus, ChatType, ContentType, ZealStatus, NotificationType } from "../models/enums.js";
import { getTimeAgo } from "../utils/timeAgo.js";
import { formatTime12Hour } from "../utils/timeFormatter.js";
import { getMediaForUser } from "./media.service.js";
import { getPaginationMeta } from "../utils/pagination.js";
import { getOrCreateChatRoom } from "./chatRoom.service.js";
import { createNotification } from "./notification.service.js";
import { canSendMessage, checkBlockStatus } from "./chatBlock.service.js";
import { shareContent } from "./content-share.service.js";
import logger from "../utils/logger.js";

/** ContentType (Post, Write Post, Zeal Post, Poll) -> MessageType for chat */
const contentTypeToMessageType = {
  [ContentType.POST]: MessageType.POST,
  [ContentType.WRITE_POST]: MessageType.WRITE_POST,
  [ContentType.ZEAL]: MessageType.ZEAL,
  [ContentType.POLL]: MessageType.POLL,
};

/**
 * Get request status for a chat room
 * "pending" = message request not accepted yet, "accepted" = normal/direct chat
 * @param {Object} room - ChatRoom document
 * @returns {string} "pending" or "accepted"
 */
export const getRequestStatus = (room) => {
  return room.chatType === ChatType.REQUEST ? "pending" : "accepted";
};

/**
 * Get mediaUrl and thumbnailUrl from shared content (Post / Write Post / Zeal) for chat message display.
 * @param {string} messageType - MessageType: "Post" | "Write Post" | "Zeal"
 * @param {string} contentId - Content ID
 * @returns {Promise<{ mediaUrl: string|null, thumbnailUrl: string|null }>}
 */
const getContentMediaForMessage = async (messageType, contentId) => {
  if (!contentId) return { mediaUrl: null, thumbnailUrl: null };
  try {
    switch (messageType) {
      case MessageType.ZEAL: {
        const zeal = await ZealPost.findById(contentId).select("mediaUrl thumbnailUrl").lean();
        return {
          mediaUrl: zeal?.mediaUrl || null,
          thumbnailUrl: zeal?.thumbnailUrl || null,
        };
      }
      case MessageType.POST: {
        const post = await Post.findById(contentId).select("images").lean();
        const firstImage = post?.images?.[0] || null;
        return {
          mediaUrl: firstImage || null,
          thumbnailUrl: firstImage || null,
        };
      }
      case MessageType.WRITE_POST:
        return { mediaUrl: null, thumbnailUrl: null };
      default:
        return { mediaUrl: null, thumbnailUrl: null };
    }
  } catch (e) {
    logger.warn("getContentMediaForMessage:", e?.message);
    return { mediaUrl: null, thumbnailUrl: null };
  }
};

/**
 * Fetch contentData for a given contentType and contentId.
 * Used in both sendMessage (for new_message socket event) and getMessages.
 */
const fetchContentData = async (contentType, contentId, userId = null) => {
  try {
    switch (contentType) {
      case "Post": {
        const post = await Post.findById(contentId)
          .select("caption userId images mentionedUserIds musicId shareCount createdAt")
          .populate("musicId", "title artist audioUrl coverImage duration")
          .lean();

        if (!post) return null;

        return {
          caption: post.caption || "",
          userId: post.userId,
          images: post.images || [],
          mentionedUserIds: post.mentionedUserIds || [],
          music: post.musicId || null, // populated
          shareCount: post.shareCount || 0,
          createdAt: post.createdAt,
        };
      }

      case "Write Post": {
        const writePost = await WritePost.findById(contentId)
          .select("content userId mentionedUserIds shareCount createdAt")
          .lean();

        if (!writePost) return null;

        return {
          content: writePost.content,
          excerpt: writePost.content
            ? writePost.content.substring(0, 150) +
              (writePost.content.length > 150 ? "..." : "")
            : "",
          author: writePost.userId,
          mentionedUserIds: writePost.mentionedUserIds || [],
          shareCount: writePost.shareCount || 0,
          createdAt: writePost.createdAt,
        };
      }

      case "Zeal": {
        const zealPost = await ZealPost.findById(contentId)
          .select("caption mediaUrl thumbnailUrl userId mentionedUserIds shareCount createdAt musicId")
          .populate("musicId", "title artist audioUrl coverImage duration")
          .lean();

        if (!zealPost) return null;

        return {
          caption: zealPost.caption || "",
          mediaUrl: zealPost.mediaUrl,
          thumbnailUrl: zealPost.thumbnailUrl,
          userId: zealPost.userId,
          music: zealPost.musicId || null, // populated
          mentionedUserIds: zealPost.mentionedUserIds || [],
          shareCount: zealPost.shareCount || 0,
          createdAt: zealPost.createdAt,
        };
      }

      case "Poll": {
        const poll = await Poll.findById(contentId)
          .select("caption options totalVotes duration createdBy userVotes")
          .lean();

        if (!poll) return null;

        let hasVoted = false;
        let selectedOptionId = null;

        if (userId) {
          const currentUserIdStr = userId.toString();

          const userVote = poll.userVotes
            ? poll.userVotes.find(
                (v) => v.userId.toString() === currentUserIdStr
              )
            : null;

          hasVoted = !!userVote;
          selectedOptionId = userVote ? userVote.optionId : null;
        }

        return {
          question: poll.caption,
          options: poll.options,
          totalVotes: poll.totalVotes || 0,
          expiresAt: poll.duration,
          createdBy: poll.createdBy,
          userVoted: hasVoted,
          selectedOptionId,
        };
      }

      default:
        return null;
    }
  } catch (err) {
    logger.warn(
      `fetchContentData failed for ${contentType} ${contentId}:`,
      err.message
    );
    return null;
  }
};

/**
 * Send a message in a chat room.
 * Supports mediaId (from POST /media/upload): resolve to mediaUrl/thumbnailUrl.
 * For contentId+contentType (Post/Zeal/Write Post), resolves media/thumbnail from content for display.
 * @param {string} roomId - Room ID
 * @param {string} senderId - Sender user ID
 * @param {Object} messageData - { messageType, message?, mediaId?, mediaUrl?, thumbnailUrl?, contentId?, contentType? }
 * @returns {Promise<Object>} Created message
 */
export const sendMessage = async (roomId, senderId, messageData) => {
  try {
    const { messageType, message, mediaId, mediaUrl, thumbnailUrl, contentId, contentType, contentData } = messageData;

    let resolvedMediaUrl = mediaUrl || null;
    let resolvedThumbnailUrl = thumbnailUrl || null;

    if (mediaId) {
      const media = await getMediaForUser(mediaId, senderId);
      resolvedMediaUrl = media.mediaUrl;
      resolvedThumbnailUrl = media.thumbnailUrl;
    } else if (contentId && (contentType || messageType) && [MessageType.POST, MessageType.WRITE_POST, MessageType.ZEAL].includes(messageType)) {
      const contentMedia = await getContentMediaForMessage(messageType, contentId);
      resolvedMediaUrl = resolvedMediaUrl || contentMedia.mediaUrl;
      resolvedThumbnailUrl = resolvedThumbnailUrl || contentMedia.thumbnailUrl;
    }

    // Verify room exists and user is a participant
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: senderId }, { userB: senderId }],
    });

    if (!room) {
      throw new Error("Chat room not found or access denied");
    }

    // Check if users have blocked each other
    const otherUserId = room.userA.toString() === senderId ? room.userB : room.userA;
    const blockCheck = await canSendMessage(senderId, otherUserId);

    if (!blockCheck.canSend) {
      throw new Error(blockCheck.message);
    }

    // Message request rules: only requester can send; recipient cannot send until they accept
    if (room.chatType === ChatType.REQUEST) {
      const requesterIdStr = room.requesterId && room.requesterId.toString();
      if (requesterIdStr !== senderId) {
        throw new Error("You must accept the request before sending messages");
      }
    }

    // Fetch contentData if not provided by client (e.g. when sharing Post/Poll/Write)
    let resolvedContentData = contentData || null;
    if (!resolvedContentData && contentId && contentType) {
      resolvedContentData = await fetchContentData(contentType, contentId, senderId);
    }

    // Create message
    const newMessage = await ChatMessage.create({
      roomId,
      senderId,
      messageType,
      message: message || null,
      mediaUrl: resolvedMediaUrl,
      thumbnailUrl: resolvedThumbnailUrl,
      contentId: contentId || null,
      contentType: contentType || null,
      contentData: resolvedContentData,
      status: MessageStatus.SENT,
    });

    // Update room's last message
    const lastPreview = message ||
      (messageType === MessageType.IMAGE ? "Image" :
       messageType === MessageType.SNAP ? "Snap" :
       messageType === MessageType.POST ? "Post" :
       messageType === MessageType.WRITE_POST ? "Write Post" :
       messageType === MessageType.ZEAL ? "Zeal" :
       messageType === MessageType.POLL ? "Poll" :
       null);
    room.lastMessage = lastPreview;
    room.lastMessageType = messageType;
    room.lastMessageAt = newMessage.createdAt;
    if (room.deletedBy && room.deletedBy.length > 0) {
      room.deletedBy = [];
    }
    await room.save();

    // Update unread counts
    await Promise.all([
      // Increment unread count for other user
      ChatParticipant.findOneAndUpdate(
        { roomId, userId: otherUserId },
        { $inc: { unreadCount: 1 } },
        { upsert: true, new: true }
      ),
      // Reset unread count for sender
      ChatParticipant.findOneAndUpdate(
        { roomId, userId: senderId },
        {
          unreadCount: 0,
          lastReadMessageId: newMessage._id,
          lastReadAt: new Date(),
        },
        { upsert: true, new: true }
      ),
      // Auto-mark other user's messages as READ when sender replies
      // Exclude SNAP messages — only mark SEEN when actually viewed
      ChatMessage.updateMany(
        {
          roomId,
          senderId: otherUserId,
          messageType: { $ne: MessageType.SNAP },
          status: { $in: [MessageStatus.SENT, MessageStatus.DELIVERED] },
          createdAt: { $lte: newMessage.createdAt },
        },
        { status: MessageStatus.SEEN }
      ),
    ]);

    // Populate sender info
    await newMessage.populate("senderId", "name username profileImage bio isVerifiedBadge");

    // Format response
    const formattedMessage = {
      id: newMessage._id.toString(),
      roomId: roomId.toString(),
      sender: {
        id: newMessage.senderId._id.toString(),
        name: newMessage.senderId.name,
        username: newMessage.senderId.username,
        profileImage: newMessage.senderId.profileImage,
        bio: newMessage.senderId.bio,
        isVerifiedBadge: newMessage.senderId.isVerifiedBadge,
      },
      messageType: newMessage.messageType,
      message: newMessage.message,
      mediaUrl: newMessage.mediaUrl,
      thumbnailUrl: newMessage.thumbnailUrl,
      contentId: newMessage.contentId ? newMessage.contentId.toString() : null,
      contentType: newMessage.contentType,
      contentData: resolvedContentData,
      status: newMessage.status,
      statusDisplay: newMessage.status === MessageStatus.SEEN ? "seen" :
                     newMessage.status === MessageStatus.DELIVERED ? "Delivered" : "Delivered",
      timestamp: formatTime12Hour(newMessage.createdAt),
      timeAgo: getTimeAgo(newMessage.createdAt),
      createdAt: newMessage.createdAt,
      requestStatus: getRequestStatus(room),
    };

    // Add content creator profile for shared content
    if (newMessage.contentId && newMessage.contentType) {
      try {
        let creator = null;

        if (newMessage.contentType === "Post") {
          const post = await Post.findById(newMessage.contentId)
            .populate("userId", "name username profileImage bio isVerifiedBadge")
            .lean();
          if (post && post.userId) creator = post.userId;
        } else if (newMessage.contentType === "Write Post") {
          const writePost = await WritePost.findById(newMessage.contentId)
            .populate("userId", "name username profileImage bio isVerifiedBadge")
            .lean();
          if (writePost && writePost.userId) creator = writePost.userId;
        } else if (newMessage.contentType === "Zeal") {
          const zealPost = await ZealPost.findById(newMessage.contentId)
            .populate("userId", "name username profileImage bio isVerifiedBadge")
            .lean();
          if (zealPost && zealPost.userId) creator = zealPost.userId;
        } else if (newMessage.contentType === "Poll") {
          const poll = await Poll.findById(newMessage.contentId)
            .populate("createdBy", "name username profileImage bio isVerifiedBadge")
            .lean();
          if (poll && poll.createdBy) creator = poll.createdBy;
        }

        if (creator) {
          formattedMessage.contentCreator = {
            id: creator._id.toString(),
            name: creator.name,
            username: creator.username,
            profileImage: creator.profileImage,
            bio: creator.bio,
            isVerifiedBadge: creator.isVerifiedBadge,
          };
        }
      } catch (error) {
        logger.warn(`Failed to fetch content creator for message ${newMessage._id}:`, error.message);
      }
    }

    logger.info(`Message sent in room ${roomId} by user ${senderId}`);

    // Trigger push notification (non-blocking)
    createNotification({
      receiverId: otherUserId,
      senderId: senderId,
      type: NotificationType.NEW_MESSAGE,
      message: message || "Sent you a message",
      metadata: {
        roomId: roomId.toString(),
        messageId: newMessage._id.toString(),
        commentText: message,
      },
    }).then(notification => {
      if (notification) {
        logger.info(`Notification created for message ${newMessage._id}: ${notification._id}`);
      }
    }).catch((err) => logger.warn("Failed to create chat notification:", err.message));

    return formattedMessage;
  } catch (error) {
    logger.error("Error in sendMessage:", error);
    throw error;
  }
};

/**
 * Get messages for a chat room with pagination
 * @param {string} roomId - Room ID
 * @param {string} userId - User ID (to verify access)
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Messages with pagination
 */
export const getMessages = async (roomId, userId, page = 1, limit = 50) => {
  try {
    const skip = (page - 1) * limit;

    // Verify room exists and user is a participant
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
    });

    if (!room) {
      throw new Error("Chat room not found or access denied");
    }

    // Check block status between users
    const otherUserId = room.userA.toString() === userId ? room.userB : room.userA;
    const blockStatus = await checkBlockStatus(userId, otherUserId);

    // Fetch participant to check if chat was cleared
    const participant = await ChatParticipant.findOne({ roomId, userId }).lean();
    const messageQuery = { roomId };

    if (participant && participant.clearedAt) {
      messageQuery.createdAt = { $gt: participant.clearedAt };
    }

    // Fetch messages (newest first for pagination)
    const messages = await ChatMessage.find(messageQuery)
      .populate("senderId", "name username profileImage bio isVerifiedBadge")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await ChatMessage.countDocuments(messageQuery);

    // Request status
    const requestStatus = getRequestStatus(room);

    // Format messages
    const formattedMessages = await Promise.all(
      messages.map(async (msg) => {
        // Always re-fetch Poll (votes change in real time),
        // fetch others only if contentData is missing in DB
        let contentData = msg.contentData;
        if ((!contentData || msg.contentType === "Poll") && msg.contentId && msg.contentType) {
          contentData = await fetchContentData(msg.contentType, msg.contentId, userId);
        }

        const formattedMessage = {
          id: msg._id.toString(),
          roomId: roomId.toString(),
          sender: {
            id: msg.senderId._id.toString(),
            name: msg.senderId.name,
            username: msg.senderId.username,
            profileImage: msg.senderId.profileImage,
            bio: msg.senderId.bio,
            isVerifiedBadge: msg.senderId.isVerifiedBadge,
          },
          messageType: msg.messageType,
          message: msg.message,
          mediaUrl: msg.mediaUrl,
          thumbnailUrl: msg.thumbnailUrl,
          contentId: msg.contentId ? msg.contentId.toString() : null,
          contentType: msg.contentType,
          contentData: contentData,
          status: msg.status,
          statusDisplay: msg.status === MessageStatus.SEEN ? "seen" :
                         msg.status === MessageStatus.DELIVERED ? "Delivered" : "Delivered",
          timestamp: formatTime12Hour(msg.createdAt),
          timeAgo: getTimeAgo(msg.createdAt),
          createdAt: msg.createdAt,
          requestStatus: requestStatus,
        };

        // Add content creator profile for shared content
        if (msg.contentId && msg.contentType) {
          try {
            let creator = null;

            if (msg.contentType === "Post") {
              const post = await Post.findById(msg.contentId)
                .populate("userId", "name username profileImage bio isVerifiedBadge")
                .lean();
              if (post && post.userId) creator = post.userId;
            } else if (msg.contentType === "Write Post") {
              const writePost = await WritePost.findById(msg.contentId)
                .populate("userId", "name username profileImage bio isVerifiedBadge")
                .lean();
              if (writePost && writePost.userId) creator = writePost.userId;
            } else if (msg.contentType === "Zeal") {
              const zealPost = await ZealPost.findById(msg.contentId)
                .populate("userId", "name username profileImage bio isVerifiedBadge")
                .lean();
              if (zealPost && zealPost.userId) creator = zealPost.userId;
            } else if (msg.contentType === "Poll") {
              const poll = await Poll.findById(msg.contentId)
                .populate("createdBy", "name username profileImage bio isVerifiedBadge")
                .lean();
              if (poll && poll.createdBy) creator = poll.createdBy;
            }

            if (creator) {
              formattedMessage.contentCreator = {
                id: creator._id.toString(),
                name: creator.name,
                username: creator.username,
                profileImage: creator.profileImage,
                bio: creator.bio,
                isVerifiedBadge: creator.isVerifiedBadge,
              };
            }
          } catch (error) {
            logger.warn(`Failed to fetch content creator for message ${msg._id}:`, error.message);
          }
        }

        return formattedMessage;
      })
    );

    return {
      messages: formattedMessages,
      pagination: getPaginationMeta(total, page, limit),
      requestStatus,
      blockStatus,
    };
  } catch (error) {
    logger.error("Error in getMessages:", error);
    throw error;
  }
};

/**
 * Delete a single message in a chat room
 * Only the message sender can delete their own message
 * @param {string} roomId - Room ID
 * @param {string} messageId - Message ID to delete
 * @param {string} userId - User ID (must be sender to delete)
 * @returns {Promise<Object>} Deleted message info
 */
export const deleteMessage = async (roomId, messageId, userId) => {
  try {
    const room = await ChatRoom.findOne({
      _id: roomId,
      $or: [{ userA: userId }, { userB: userId }],
    });

    if (!room) {
      throw new Error("Chat room not found or access denied");
    }

    const message = await ChatMessage.findOne({
      _id: messageId,
      roomId,
    });

    if (!message) {
      throw new Error("Message not found");
    }

    if (message.senderId.toString() !== userId) {
      throw new Error("You can only delete your own messages");
    }

    await ChatMessage.deleteOne({ _id: messageId });

    // If deleted message was room's last message, update room with previous message
    const lastMsg = await ChatMessage.findOne({ roomId })
      .sort({ createdAt: -1 })
      .lean();

    if (lastMsg) {
      let lastPreview = lastMsg.message;
      if (lastMsg.messageType === MessageType.IMAGE) lastPreview = "📷 Image";
      else if (lastMsg.messageType === MessageType.SNAP) lastPreview = "📸 Byte Opened";
      else if (lastMsg.messageType === MessageType.POST) lastPreview = "📌 Post";
      else if (lastMsg.messageType === MessageType.WRITE_POST) lastPreview = "✍️ Write Post";
      else if (lastMsg.messageType === MessageType.ZEAL) lastPreview = "🎬 Zeal";
      room.lastMessage = lastPreview;
      room.lastMessageType = lastMsg.messageType;
      room.lastMessageAt = lastMsg.createdAt;
    } else {
      room.lastMessage = null;
      room.lastMessageType = null;
      room.lastMessageAt = null;
    }
    await room.save();

    logger.info(`Message ${messageId} deleted in room ${roomId} by user ${userId}`);

    return { roomId, messageId };
  } catch (error) {
    logger.error("Error in deleteMessage:", error);
    throw error;
  }
};

/**
 * Verify content exists and is shareable (Zeal must be published).
 * @param {string} contentType - ContentType (Post, Write Post, Zeal Post)
 * @param {string} contentId - Content ID
 * @returns {Promise<Object|null>} Content doc or null
 */
const verifyContentForShare = async (contentType, contentId) => {
  switch (contentType) {
    case ContentType.POST:
      return Post.findById(contentId).lean();
    case ContentType.WRITE_POST:
      return WritePost.findById(contentId).lean();
    case ContentType.ZEAL:
      return ZealPost.findOne({ _id: contentId, status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] } }).lean();
    case ContentType.POLL:
      return Poll.findById(contentId).lean();
    default:
      return null;
  }
};

/**
 * Send one content (Zeal / Post / Write Post / Poll) to multiple users' personal chats at once.
 * For each recipient: get or create room with them, then send the content as a chat message.
 * @param {string} senderId - Sender user ID
 * @param {string} contentType - "Post" | "Write Post" | "Zeal Post" | "Poll"
 * @param {string} contentId - Content ID (postId / writePostId / zealId / pollId)
 * @param {string[]} recipientIds - Array of recipient user IDs
 * @param {boolean} skipShareTracking - If true, skips shareContent call (used when shareContent already called)
 * @returns {Promise<{ results: Array<{ roomId, recipientId, message?, error? }>, successCount, failCount }>}
 */
export const sendContentToMultipleChats = async (senderId, contentType, contentId, recipientIds, skipShareTracking = false) => {
  logger.info(`sendContentToMultipleChats called with:`, {
    senderId,
    contentType,
    contentId,
    recipientIds
  });

  logger.info(`Available ContentType values:`, Object.values(ContentType));
  logger.info(`Checking contentType: "${contentType}" (type: ${typeof contentType})`);

  const messageType = contentTypeToMessageType[contentType];
  logger.info(`Mapped contentType "${contentType}" to messageType "${messageType}"`);
  if (!messageType) {
    logger.error(`Invalid contentType: ${contentType}. Available types:`, Object.keys(contentTypeToMessageType));
    throw new Error("Invalid contentType. Use: Post, Write Post, Zeal Post, or Poll");
  }

  logger.info(`Mapped contentType ${contentType} to messageType ${messageType}`);

  // Fetch content with required fields for contentData
  logger.info(`Starting content fetch for ${contentType} ${contentId}`);
  let content;
  switch (contentType) {
    case ContentType.POST:
      content = await Post.findById(contentId).lean();
      break;
    case ContentType.WRITE_POST:
      content = await WritePost.findById(contentId)
        .select('title content userId createdAt')
        .lean();
      break;
    case ContentType.ZEAL:
      content = await ZealPost.findOne({ 
        _id: contentId, 
        status: { $in: [ZealStatus.PUBLISHED, ZealStatus.READY] } 
      })
      .select('title description mediaUrl thumbnailUrl userId createdAt')
      .lean();
      break;
    case ContentType.POLL:
      content = await Poll.findById(contentId)
        .select('caption options totalVotes duration createdBy createdAt userVotes')
        .lean();
      break;
    default:
      content = null;
  }

  logger.info(`Fetched content: ${JSON.stringify(content)}`);

  if (!content) {
    logger.error(`Content not found or not shareable: ${contentType} ${contentId}`);
    throw new Error("Content not found or not shareable (Zeal must be published)");
  }

  logger.info(`Content verified successfully:`, { contentType, contentId });

  // Prepare contentData for polls and write posts
  let contentData = null;
  logger.info(`About to prepare contentData. contentType: ${contentType}, has content: ${!!content}`);
  
  if (contentType === ContentType.WRITE_POST && content) {
    contentData = {
      title: content.title,
      content: content.content,
      excerpt: content.content ? content.content.substring(0, 150) + (content.content.length > 150 ? "..." : "") : "",
      author: content.userId
    };
    logger.info(`Write post content data prepared: ${JSON.stringify(contentData)}`);
  } else if (contentType === ContentType.POLL && content) {
    // Check if current user has voted in this poll
    let hasVoted = false;
    let selectedOptionId = null;
    
    if (senderId) {
      const currentUserIdStr = senderId.toString();
      const userVote = content.userVotes
        ? content.userVotes.find(
            (v) => v.userId.toString() === currentUserIdStr
          )
        : null;
      
      hasVoted = !!userVote;
      selectedOptionId = userVote ? userVote.optionId : null;
    }
    
    contentData = {
      question: content.caption,
      options: content.options,
      totalVotes: content.totalVotes || 0,
      expiresAt: content.duration,
      createdBy: content.createdBy,
      userVoted: hasVoted,
      selectedOptionId,
    };
    logger.info(`Poll content data prepared: ${JSON.stringify(contentData)}`);
  } else if (contentType === ContentType.ZEAL && content) {
    contentData = {
      title: content.title,
      description: content.description,
      mediaUrl: content.mediaUrl,
      thumbnailUrl: content.thumbnailUrl,
      userId: content.userId
    };
    logger.info(`Zeal content data prepared: ${JSON.stringify(contentData)}`);
  } else {
    logger.info(`No contentData prepared for contentType: ${contentType}`);
  }

  const uniqueRecipientIds = [...new Set(recipientIds.map((id) => id.toString()))];
  const selfId = senderId.toString();
  const filtered = uniqueRecipientIds.filter((id) => id !== selfId);
  if (filtered.length === 0) {
    throw new Error("Provide at least one recipient (cannot send to yourself)");
  }

  const validUsers = await User.find({
    _id: { $in: filtered.map((id) => new mongoose.Types.ObjectId(id)) },
    isDeleted: { $ne: true },
  })
    .select("_id")
    .lean();
  const validIds = new Set(validUsers.map((u) => u._id.toString()));

  logger.info(`Found ${validUsers.length} valid recipients out of ${filtered.length} requested`);

  // Call shareContent to update share count and create share records (unless already handled)
  let shareResult = null;
  if (!skipShareTracking) {
    try {
      shareResult = await shareContent(senderId, contentType, contentId, filtered);
      logger.info(`Share count updated for ${contentType} ${contentId}. Total shares: ${shareResult?.totalShareCount}`);
    } catch (shareError) {
      logger.error("Error updating share count in sendContentToMultipleChats:", shareError);
      // Don't fail the operation, just log the error
    }
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const recipientId of filtered) {
    if (!validIds.has(recipientId)) {
      logger.warn(`Invalid recipient: ${recipientId}`);
      results.push({ roomId: null, recipientId, error: "User not found or deleted" });
      failCount++;
      continue;
    }

    try {
      logger.info(`Processing recipient: ${recipientId}`);
      const room = await getOrCreateChatRoom(senderId, recipientId);
      const roomId = room.id || room._id?.toString();

      logger.info(`Created/retrieved room ${roomId} for recipient ${recipientId}`);

      // ChatMessage contentType enum is "Post" | "Write Post" | "Zeal" | "Poll"
      const formattedMessage = await sendMessage(roomId, senderId, {
        messageType,
        contentId,
        contentType: messageType,
        contentData, // Include contentData for polls, write posts, and zeal posts
      });

      logger.info(`Successfully sent message to ${recipientId}, message ID: ${formattedMessage?.id}`);
      results.push({ roomId, recipientId, message: formattedMessage });
      successCount++;
    } catch (err) {
      logger.warn(`sendContentToMultipleChats: failed for recipient ${recipientId}:`, err.message);
      results.push({ roomId: null, recipientId, error: err.message || "Failed to send" });
      failCount++;
    }
  }

  logger.info(
    `sendContentToMultipleChats: ${contentType} ${contentId} by ${senderId} -> ${successCount} sent, ${failCount} failed`
  );

  return { 
    results, 
    successCount, 
    failCount, 
    totalShareCount: shareResult?.totalShareCount || 0 
  };
};

export default {
  sendMessage,
  getMessages,
  deleteMessage,
  sendContentToMultipleChats,
};
