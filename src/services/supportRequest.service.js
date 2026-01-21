/**
 * Support Request Service
 * Business logic for support request operations
 */

import SupportRequest from "../models/support/SupportRequest.js";
import ChatRoom from "../models/chat/ChatRoom.js";
import ChatParticipant from "../models/chat/ChatParticipant.js";
import { User } from "../models/index.js";
import { ChatType } from "../models/enums.js";
import { USER_ROLES } from "../constants/index.js";
import logger from "../utils/logger.js";

/**
 * Create a support request and assign a chat room
 * @param {string} userId - User ID
 * @param {Object} requestData - Request data
 * @returns {Promise<Object>} Created support request with chat room
 */
export const createSupportRequest = async (userId, requestData) => {
  try {
    const { subject, description, priority = "medium" } = requestData;

    // Find or get support/admin user
    // Try to find an admin user first
    let supportUser = await User.findOne({
      role: USER_ROLES.ADMIN,
      isDeleted: false,
    });

    // If no admin found, try to find a user with email "support@omeeba.com" or similar
    if (!supportUser) {
      supportUser = await User.findOne({
        email: "support@omeeba.com",
        isDeleted: false,
      });
    }

    // If still no support user, throw error (admin needs to set up support account)
    if (!supportUser) {
      throw new Error(
        "Support system not configured. Please contact administrator to set up a support account."
      );
    }

    const supportUserId = supportUser._id.toString();

    // Ensure consistent ordering (smaller ID first)
    const [userA, userB] = [userId, supportUserId].sort();

    // Check if room already exists for this support request
    let room = await ChatRoom.findOne({
      userA,
      userB,
      chatType: ChatType.REQUEST,
    });

    // If room doesn't exist, create it
    if (!room) {
      room = await ChatRoom.create({
        userA,
        userB,
        chatType: ChatType.REQUEST,
      });

      // Create participant records for both users (only if room is new)
      await Promise.all([
        ChatParticipant.create({
          roomId: room._id,
          userId,
          unreadCount: 0,
        }),
        ChatParticipant.create({
          roomId: room._id,
          userId: supportUserId,
          unreadCount: 0,
        }),
      ]);
    } else {
      // Room already exists - ensure participants exist (upsert)
      await Promise.all([
        ChatParticipant.findOneAndUpdate(
          { roomId: room._id, userId },
          { $setOnInsert: { unreadCount: 0 } },
          { upsert: true }
        ),
        ChatParticipant.findOneAndUpdate(
          { roomId: room._id, userId: supportUserId },
          { $setOnInsert: { unreadCount: 0 } },
          { upsert: true }
        ),
      ]);
    }

    // Create support request
    const supportRequest = await SupportRequest.create({
      userId,
      roomId: room._id,
      subject,
      description,
      priority,
      status: "pending",
    });

    logger.info(`Support request created: ${supportRequest._id} for user ${userId}`);

    return {
      id: supportRequest._id.toString(),
      userId: userId.toString(),
      roomId: room._id.toString(),
      subject: supportRequest.subject,
      description: supportRequest.description,
      status: supportRequest.status,
      priority: supportRequest.priority,
      createdAt: supportRequest.createdAt,
    };
  } catch (error) {
    logger.error("Error in createSupportRequest:", error);
    throw error;
  }
};

/**
 * Get support requests for a user
 * @param {string} userId - User ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Promise<Object>} Support requests with pagination
 */
export const getSupportRequests = async (userId, page = 1, limit = 20) => {
  try {
    const skip = (page - 1) * limit;

    const requests = await SupportRequest.find({ userId })
      .populate("roomId")
      .populate("assignedTo", "name username profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await SupportRequest.countDocuments({ userId });

    const formattedRequests = requests.map((req) => ({
      id: req._id.toString(),
      roomId: req.roomId._id.toString(),
      subject: req.subject,
      description: req.description,
      status: req.status,
      priority: req.priority,
      assignedTo: req.assignedTo
        ? {
            id: req.assignedTo._id.toString(),
            name: req.assignedTo.name,
            username: req.assignedTo.username,
            profileImage: req.assignedTo.profileImage,
          }
        : null,
      createdAt: req.createdAt,
      updatedAt: req.updatedAt,
    }));

    return {
      requests: formattedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error("Error in getSupportRequests:", error);
    throw error;
  }
};

export default {
  createSupportRequest,
  getSupportRequests,
};
