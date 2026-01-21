import { getEligibleUsersForSharing } from "../services/content-share-user.service.js";
import { sendPaginated, sendError } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";
import { getPagination, getPaginationMeta } from "../utils/pagination.js";

/**
 * Get eligible users for content sharing
 * @route GET /api/v1/content-shares/users
 * @access Private
 * @query { search?: string, page?: number, limit?: number, type?: 'all' | 'followers' | 'following' | 'searchable' }
 */
export const getEligibleUsers = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { search, type = "all" } = req.query;
    const { page, limit } = getPagination(req);

    // Validate type
    const validTypes = ["all", "followers", "following", "searchable"];
    if (!validTypes.includes(type)) {
      return sendError(
        res,
        "Invalid type parameter",
        "Validation Error",
        `Type must be one of: ${validTypes.join(", ")}`,
        StatusCodes.BAD_REQUEST
      );
    }

    // Get eligible users
    const result = await getEligibleUsersForSharing(senderId, {
      search: search || "",
      page,
      limit,
      type,
    });

    // Get pagination metadata
    const pagination = getPaginationMeta(
      result.pagination.total,
      page,
      limit
    );

    return sendPaginated(
      res,
      result.users,
      pagination,
      "Eligible users retrieved successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Get eligible users error:", error);

    return sendError(
      res,
      "Failed to get eligible users",
      "Get Eligible Users Error",
      error.message || "An error occurred while retrieving eligible users",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  getEligibleUsers,
};

