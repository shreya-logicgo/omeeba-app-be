import User from "../models/users/User.js";
import logger from "../utils/logger.js";

/**
 * Update User Profile
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update (name, username, bio, profileImage, coverImage)
 * @returns {Promise<Object>} Updated user (without password and sensitive data)
 */
export const updateProfile = async (userId, updateData) => {
  try {
    // Find user
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Prepare update object (only include provided fields)
    const updateFields = {};

    if (updateData.name !== undefined) {
      updateFields.name = updateData.name.trim();
    }

    if (updateData.username !== undefined) {
      const newUsername = updateData.username.trim().toLowerCase();

      // Check if username is different from current
      if (newUsername !== user.username) {
        // Check if username already exists
        const existingUser = await User.findOne({
          username: newUsername,
          _id: { $ne: userId },
          isDeleted: false,
        });

        if (existingUser) {
          throw new Error("Username is already taken. Please choose another one");
        }

        updateFields.username = newUsername;
      }
    }

    if (updateData.bio !== undefined) {
      updateFields.bio = updateData.bio.trim();
    }

    if (updateData.profileImage !== undefined) {
      updateFields.profileImage = updateData.profileImage || null;
    }

    if (updateData.coverImage !== undefined) {
      updateFields.coverImage = updateData.coverImage || null;
    }

    // Update user
    Object.assign(user, updateFields);
    await user.save();

    logger.info(`Profile updated for user ${user.email}`);

    // Return user without password and sensitive data
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.otp;
    delete userObject.otpExpireAt;
    delete userObject.forgotPasswordOTP;
    delete userObject.forgotPasswordOTPExpireAt;
    delete userObject.forgotPasswordOTPVerified;
    delete userObject.forgotPasswordOTPVerifiedAt;

    return userObject;
  } catch (error) {
    logger.error("Error in updateProfile:", error);
    throw error;
  }
};

export default {
  updateProfile,
};

