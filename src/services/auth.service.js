/**
 * Auth Service
 * Business logic for authentication
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/users/User.js";
import { sendOTPEmail, sendForgotPasswordOTPEmail } from "./email.service.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";

/**
 * Generate OTP
 * @returns {number} 6-digit OTP
 */
export const generateOTP = () => {
  const min = Math.pow(10, config.otp.length - 1);
  const max = Math.pow(10, config.otp.length) - 1;
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Hash password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
};

/**
 * Compare password
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<boolean>} True if passwords match
 */
export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Register new user
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {number} userData.phoneNumber - User phone number
 * @param {string} userData.countryCode - Country code
 * @param {string} userData.name - User name
 * @param {string} userData.username - Username
 * @param {string} userData.password - Password
 * @returns {Promise<Object>} Created user (without password) or existing unverified user
 */
export const registerUser = async (userData) => {
  try {
    const { email, phoneNumber, countryCode, name, username, password } =
      userData;

    // Check if user already exists with email
    const existingUserByEmail = await User.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    // If user exists and is already verified, throw error
    if (existingUserByEmail && existingUserByEmail.isAccountVerified) {
      throw new Error("An account with this email already exists");
    }

    // If user exists but not verified, resend OTP
    if (existingUserByEmail && !existingUserByEmail.isAccountVerified) {
      // Check if new phone number is already taken by another user
      if (phoneNumber && phoneNumber !== existingUserByEmail.phoneNumber) {
        const existingUserByPhone = await User.findOne({
          phoneNumber,
          isDeleted: false,
          _id: { $ne: existingUserByEmail._id }, // Exclude current user
        });

        if (existingUserByPhone) {
          throw new Error("An account with this phone number already exists");
        }
      }

      // Check if new username is already taken by another user
      if (username && username.toLowerCase() !== existingUserByEmail.username) {
        const existingUserByUsername = await User.findOne({
          username: username.toLowerCase(),
          isDeleted: false,
          _id: { $ne: existingUserByEmail._id }, // Exclude current user
        });

        if (existingUserByUsername) {
          throw new Error("This username is already taken");
        }
      }

      // Generate new OTP
      const otp = generateOTP();
      const otpExpireAt = new Date();
      otpExpireAt.setMinutes(
        otpExpireAt.getMinutes() + config.otp.expireMinutes
      );

      // Update user with new OTP
      existingUserByEmail.otp = otp;
      existingUserByEmail.otpExpireAt = otpExpireAt;

      // Update other fields if provided
      if (phoneNumber) existingUserByEmail.phoneNumber = phoneNumber;
      if (countryCode) existingUserByEmail.countryCode = countryCode;
      if (name) existingUserByEmail.name = name;
      if (username) existingUserByEmail.username = username.toLowerCase();
      if (password) {
        existingUserByEmail.password = await hashPassword(password);
      }

      await existingUserByEmail.save();

      // Send OTP email
      try {
        await sendOTPEmail(existingUserByEmail.email, otp);
        logger.info(`OTP resent to ${existingUserByEmail.email}`);
      } catch (emailError) {
        logger.error(
          `Failed to send OTP email to ${existingUserByEmail.email}:`,
          emailError
        );
        // Don't throw error - user can request OTP resend
      }

      // Return user without password
      const userObject = existingUserByEmail.toObject();
      delete userObject.password;
      delete userObject.otp;

      return {
        ...userObject,
        isResendOTP: true, // Flag to indicate OTP was resent
      };
    }

    // Check if user already exists with phone number (only for new registrations)
    if (phoneNumber) {
      const existingUserByPhone = await User.findOne({
        phoneNumber,
        isDeleted: false,
      });

      if (existingUserByPhone) {
        throw new Error("An account with this phone number already exists");
      }
    }

    // Check if username already exists (only for new registrations)
    const existingUserByUsername = await User.findOne({
      username: username.toLowerCase(),
      isDeleted: false,
    });

    if (existingUserByUsername) {
      throw new Error("This username is already taken");
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Generate OTP
    const otp = generateOTP();
    const otpExpireAt = new Date();
    otpExpireAt.setMinutes(otpExpireAt.getMinutes() + config.otp.expireMinutes);

    // Create new user
    const user = await User.create({
      email: email.toLowerCase(),
      phoneNumber,
      countryCode,
      name,
      username: username.toLowerCase(),
      password: hashedPassword,
      otp,
      otpExpireAt,
      isAccountVerified: false,
    });

    // Send OTP email
    try {
      await sendOTPEmail(user.email, otp);
      logger.info(`OTP sent to ${user.email}`);
    } catch (emailError) {
      logger.error(`Failed to send OTP email to ${user.email}:`, emailError);
      // Don't throw error - user is created, they can request OTP resend
    }

    // Return user without password
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.otp;

    return userObject;
  } catch (error) {
    logger.error("Error in registerUser:", error);
    throw error;
  }
};

/**
 * Verify OTP
 * Handles both account verification and forgot password OTP
 * @param {string} email - User email
 * @param {number} otp - OTP code
 * @param {string} type - OTP type: "account" or "password" (optional, auto-detected if not provided)
 * @returns {Promise<Object>} Verified user or success message
 */
export const verifyOTP = async (email, otp, type = null) => {
  try {
    // Find user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (!user) {
      throw new Error("No account found with this email address");
    }

    // Auto-detect type if not provided
    if (!type) {
      if (user.otp && !user.isAccountVerified) {
        type = "account";
      } else if (user.forgotPasswordOTP) {
        type = "password";
      } else {
        throw new Error(
          "No verification code found. Please request a new code"
        );
      }
    }

    // Handle account verification OTP
    if (type === "account") {
      // Check if user is already verified
      if (user.isAccountVerified) {
        throw new Error("Your account is already verified");
      }

      // Check if OTP exists
      if (!user.otp) {
        throw new Error(
          "No verification code found. Please request a new code"
        );
      }

      // Check if OTP is expired
      if (user.otpExpireAt && new Date() > user.otpExpireAt) {
        throw new Error(
          "Verification code has expired. Please request a new code"
        );
      }

      // Verify OTP
      if (user.otp !== parseInt(otp, 10)) {
        throw new Error("Invalid verification code");
      }

      // Mark account as verified and clear OTP
      user.isAccountVerified = true;
      user.otp = null;
      user.otpExpireAt = null;
      await user.save();

      logger.info(`Account verified for ${user.email}`);

      // Return user without password and OTP
      const userObject = user.toObject();
      delete userObject.password;
      delete userObject.otp;
      delete userObject.forgotPasswordOTP;
      delete userObject.forgotPasswordOTPExpireAt;

      return {
        user: userObject,
        type: "account",
      };
    }

    // Handle forgot password OTP
    if (type === "password") {
      // Check if account is verified
      if (!user.isAccountVerified) {
        throw new Error("Please verify your email address first");
      }

      // Check if OTP exists
      if (!user.forgotPasswordOTP) {
        throw new Error(
          "No password reset code found. Please request a new code"
        );
      }

      // Check if OTP is expired
      if (
        user.forgotPasswordOTPExpireAt &&
        new Date() > user.forgotPasswordOTPExpireAt
      ) {
        throw new Error(
          "Password reset code has expired. Please request a new code"
        );
      }

      // Verify OTP
      if (user.forgotPasswordOTP !== parseInt(otp, 10)) {
        throw new Error("Invalid verification code");
      }

      // Mark OTP as verified
      user.forgotPasswordOTPVerified = true;
      user.forgotPasswordOTPVerifiedAt = new Date();
      await user.save();

      logger.info(`Forgot password OTP verified for ${user.email}`);

      // Return success message (OTP is verified, ready for password reset)
      // Don't clear OTP here - it will be cleared when password is reset
      return {
        message: "OTP verified successfully",
        type: "password",
      };
    }

    throw new Error("Invalid verification type");
  } catch (error) {
    logger.error("Error in verifyOTP:", error);
    throw error;
  }
};

/**
 * Resend OTP
 * @param {string} email - User email
 * @returns {Promise<Object>} User with new OTP sent
 */
export const resendOTP = async (email) => {
  try {
    // Find user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (!user) {
      throw new Error("No account found with this email address");
    }

    // Check if user is already verified
    if (user.isAccountVerified) {
      throw new Error("Your account is already verified");
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpireAt = new Date();
    otpExpireAt.setMinutes(otpExpireAt.getMinutes() + config.otp.expireMinutes);

    // Update user with new OTP
    user.otp = otp;
    user.otpExpireAt = otpExpireAt;
    await user.save();

    // Send OTP email
    try {
      await sendOTPEmail(user.email, otp);
      logger.info(`OTP resent to ${user.email}`);
    } catch (emailError) {
      logger.error(`Failed to send OTP email to ${user.email}:`, emailError);
      throw new Error("Failed to send OTP email. Please try again later");
    }

    // Return user without password and OTP
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.otp;

    return userObject;
  } catch (error) {
    logger.error("Error in resendOTP:", error);
    throw error;
  }
};

/**
 * Generate JWT token
 * @param {string} userId - User ID
 * @returns {string} JWT token
 */
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, config.jwt.secretKey, {
    expiresIn: config.jwt.expiresIn,
  });
};

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User data with token
 */
export const loginUser = async (email, password) => {
  try {
    // Find user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Check if account is verified
    if (!user.isAccountVerified) {
      throw new Error("Please verify your email address first");
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    // Generate JWT token with only user _id in payload
    const token = generateToken(user._id.toString());

    logger.info(`User logged in: ${user.email}`);

    // Return user data without password and OTP
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.otp;
    delete userObject.otpExpireAt;

    return {
      user: userObject,
      token,
    };
  } catch (error) {
    logger.error("Error in loginUser:", error);
    throw error;
  }
};

/**
 * Forgot Password - Send OTP
 * @param {string} email - User email
 * @returns {Promise<Object>} Success message
 */
export const forgotPassword = async (email) => {
  try {
    // Find user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (!user) {
      // Don't reveal if user exists or not for security
      logger.warn(`Forgot password requested for non-existent email: ${email}`);
      return { message: "If the email exists, an OTP has been sent" };
    }

    // Check if account is verified
    if (!user.isAccountVerified) {
      throw new Error("Account not verified. Please verify your email first");
    }

    // Generate new OTP for password reset
    const otp = generateOTP();
    const otpExpireAt = new Date();
    otpExpireAt.setMinutes(otpExpireAt.getMinutes() + config.otp.expireMinutes);

    // Update user with forgot password OTP and reset verification flags
    user.forgotPasswordOTP = otp;
    user.forgotPasswordOTPExpireAt = otpExpireAt;
    user.forgotPasswordOTPVerified = false;
    user.forgotPasswordOTPVerifiedAt = null;
    await user.save();

    // Send OTP email
    try {
      await sendForgotPasswordOTPEmail(user.email, otp);
      logger.info(`Forgot password OTP sent to ${user.email}`);
    } catch (emailError) {
      logger.error(
        `Failed to send forgot password OTP email to ${user.email}:`,
        emailError
      );
      throw new Error("Failed to send OTP email. Please try again later");
    }

    // Return success (don't reveal if user exists)
    return { message: "If the email exists, an OTP has been sent" };
  } catch (error) {
    logger.error("Error in forgotPassword:", error);
    throw error;
  }
};

/**
 * Reset Password
 * OTP should be verified first using verify-otp endpoint with type="password"
 * @param {string} email - User email
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Updated user (without password and OTP)
 */
export const resetPassword = async (email, newPassword) => {
  try {
    // Find user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (!user) {
      throw new Error(
        "No account found with this email address. Please check your email and try again"
      );
    }

    // Check if account is verified
    if (!user.isAccountVerified) {
      throw new Error(
        "Your account is not verified. Please verify your email address first to reset your password"
      );
    }

    // Check if OTP exists (must be verified first via verify-otp API)
    if (!user.forgotPasswordOTP) {
      throw new Error(
        "Please verify the code sent to your email before resetting your password"
      );
    }

    // Check if OTP is expired
    if (
      user.forgotPasswordOTPExpireAt &&
      new Date() > user.forgotPasswordOTPExpireAt
    ) {
      throw new Error(
        "The verification code has expired. Please request a new password reset code"
      );
    }

    // Check if OTP is verified (must be verified via verify-otp API first)
    if (!user.forgotPasswordOTPVerified) {
      throw new Error("Please verify the code sent to your email first");
    }

    // Check if verification is still valid (within 15 minutes of verification)
    const verificationValidDuration = 15 * 60 * 1000; // 15 minutes in milliseconds
    if (
      !user.forgotPasswordOTPVerifiedAt ||
      new Date() - new Date(user.forgotPasswordOTPVerifiedAt) >
        verificationValidDuration
    ) {
      throw new Error("Verification has expired. Please verify the code again");
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear OTP and verification flags
    user.password = hashedPassword;
    user.forgotPasswordOTP = null;
    user.forgotPasswordOTPExpireAt = null;
    user.forgotPasswordOTPVerified = false;
    user.forgotPasswordOTPVerifiedAt = null;
    await user.save();

    logger.info(`Password reset successful for ${user.email}`);

    // Return user without password and OTP
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.otp;
    delete userObject.forgotPasswordOTP;
    delete userObject.otpExpireAt;
    delete userObject.forgotPasswordOTPExpireAt;
    delete userObject.forgotPasswordOTPVerified;
    delete userObject.forgotPasswordOTPVerifiedAt;

    return userObject;
  } catch (error) {
    logger.error("Error in resetPassword:", error);
    throw error;
  }
};

export default {
  registerUser,
  verifyOTP,
  resendOTP,
  loginUser,
  forgotPassword,
  resetPassword,
  generateToken,
  generateOTP,
  hashPassword,
  comparePassword,
};
