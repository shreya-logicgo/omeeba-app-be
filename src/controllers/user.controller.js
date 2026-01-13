import { updateProfile as updateProfileService } from "../services/user.service.js";
import { sendSuccess, sendError, sendBadRequest } from "../utils/response.js";
import { StatusCodes } from "http-status-codes";
import logger from "../utils/logger.js";

/**
 * Update Profile
 * @route PUT /api/v1/users/profile
 * @access Private
 */
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;

    // Update profile
    const user = await updateProfileService(userId, updateData);

    // Return success response
    return sendSuccess(
      res,
      {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          username: user.username,
          bio: user.bio,
          profileImage: user.profileImage,
          coverImage: user.coverImage,
          isAccountVerified: user.isAccountVerified,
          isVerifiedBadge: user.isVerifiedBadge,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      },
      "Profile updated successfully",
      StatusCodes.OK
    );
  } catch (error) {
    logger.error("Update profile error:", error);

    // Handle custom errors
    if (error.message) {
      return sendBadRequest(res, error.message);
    }

    // Generic error
    return sendError(
      res,
      "Failed to update profile",
      "Update Profile Error",
      error.message || "An error occurred while updating profile",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

export default {
  updateProfile,
};

