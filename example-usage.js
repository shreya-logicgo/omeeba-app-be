/**
 * Example usage of Omeeba MongoDB Models
 * This file demonstrates how to use the models in your application
 */

const mongoose = require('mongoose');
const { connectDB } = require('./config/database');
const {
  User,
  Post,
  WritePost,
  ZealPost,
  Comment,
  ContentLike,
  UserFollower,
  Music,
  Poll,
  Notification,
  ChatRoom,
  ChatMessage,
  Enums
} = require('./models');

// Example: Connect to database
async function initializeDatabase() {
  try {
    await connectDB(process.env.MONGODB_URI || 'mongodb://localhost:27017/omeeba');
    console.log('Database connected');
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

// Example: Create a new user
async function createUser(userData) {
  const user = new User({
    email: userData.email,
    password: userData.password, // Should be hashed
    name: userData.name,
    username: userData.username,
    phoneNumber: userData.phoneNumber,
    countryCode: userData.countryCode
  });
  
  return await user.save();
}

// Example: Create a post
async function createPost(userId, postData) {
  const post = new Post({
    userId: userId,
    caption: postData.caption,
    images: postData.images || [],
    mentionedUserIds: postData.mentionedUserIds || [],
    musicId: postData.musicId,
    musicStartTime: postData.musicStartTime,
    musicEndTime: postData.musicEndTime
  });
  
  return await post.save();
}

// Example: Create a write post
async function createWritePost(userId, writePostData) {
  const writePost = new WritePost({
    userId: userId,
    title: writePostData.title,
    content: writePostData.content,
    mentionedUserIds: writePostData.mentionedUserIds || [],
    musicId: writePostData.musicId,
    musicStartTime: writePostData.musicStartTime,
    musicEndTime: writePostData.musicEndTime
  });
  
  return await writePost.save();
}

// Example: Add a comment
async function addComment(contentType, contentId, userId, commentText) {
  const comment = new Comment({
    contentType: contentType,
    contentId: contentId,
    userId: userId,
    comment: commentText
  });
  
  return await comment.save();
}

// Example: Like content
async function likeContent(contentType, contentId, userId) {
  const like = new ContentLike({
    contentType: contentType,
    contentId: contentId,
    userId: userId
  });
  
  return await like.save();
}

// Example: Follow a user
async function followUser(userId, followerId) {
  const follow = new UserFollower({
    userId: userId,
    followerId: followerId
  });
  
  return await follow.save();
}

// Example: Get posts with populated data
async function getPostsWithDetails(limit = 10, skip = 0) {
  const posts = await Post.find()
    .populate('userId', 'name username profileImage isVerifiedBadge')
    .populate('musicId', 'title artist audioUrl coverImage')
    .populate('mentionedUserIds', 'name username')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
  
  return posts;
}

// Example: Get comments for a post
async function getPostComments(contentType, contentId) {
  const comments = await Comment.find({
    contentType: contentType,
    contentId: contentId
  })
    .populate('userId', 'name username profileImage')
    .sort({ createdAt: -1 });
  
  return comments;
}

// Example: Create a notification
async function createNotification(receiverId, senderId, type, message, contentId = null) {
  const notification = new Notification({
    receiverId: receiverId,
    senderId: senderId,
    type: type,
    message: message,
    contentId: contentId,
    status: Enums.NotificationStatus.UNREAD
  });
  
  return await notification.save();
}

// Example: Create or get chat room
async function getOrCreateChatRoom(userA, userB) {
  let chatRoom = await ChatRoom.findOne({
    $or: [
      { userA: userA, userB: userB },
      { userA: userB, userB: userA }
    ]
  });
  
  if (!chatRoom) {
    chatRoom = new ChatRoom({
      userA: userA,
      userB: userB,
      chatType: Enums.ChatType.DIRECT
    });
    await chatRoom.save();
  }
  
  return chatRoom;
}

// Example: Send a chat message
async function sendChatMessage(roomId, senderId, messageType, messageData) {
  const chatMessage = new ChatMessage({
    roomId: roomId,
    senderId: senderId,
    messageType: messageType,
    message: messageData.message || null,
    mediaUrl: messageData.mediaUrl || null,
    thumbnailUrl: messageData.thumbnailUrl || null,
    contentId: messageData.contentId || null,
    contentType: messageData.contentType || null,
    status: Enums.MessageStatus.SENT
  });
  
  // Update chat room's last message
  await ChatRoom.findByIdAndUpdate(roomId, {
    lastMessage: messageData.message || 'Media',
    lastMessageType: messageType,
    lastMessageAt: new Date()
  });
  
  return await chatMessage.save();
}

// Example: Get user feed (posts from followed users)
async function getUserFeed(userId, limit = 20) {
  // Get all users that the current user follows
  const following = await UserFollower.find({ followerId: userId })
    .select('userId');
  
  const followingIds = following.map(f => f.userId);
  
  // Get posts from followed users
  const posts = await Post.find({
    userId: { $in: followingIds }
  })
    .populate('userId', 'name username profileImage')
    .populate('musicId')
    .sort({ createdAt: -1 })
    .limit(limit);
  
  return posts;
}

module.exports = {
  initializeDatabase,
  createUser,
  createPost,
  createWritePost,
  addComment,
  likeContent,
  followUser,
  getPostsWithDetails,
  getPostComments,
  createNotification,
  getOrCreateChatRoom,
  sendChatMessage,
  getUserFeed
};

