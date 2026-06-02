/**
 * Auth Service
 * Business logic for authentication
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import mongoose from "mongoose";
import User from "../models/users/User.js";
import UserSession from "../models/users/UserSession.js";
import { sendOTPEmail, sendForgotPasswordOTPEmail } from "./email.service.js";
import config from "../config/env.js";
import logger from "../utils/logger.js";

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Generate JWT access token (15 min)
 * @param {string} userId
 * @returns {string}
 */
export const generateToken = (userId, sessionId) => {
  return jwt.sign({ id: userId, sessionId, typ: "access" }, config.jwt.secretKey, {
    expiresIn: config.jwt.expiresIn, // must be "15m" in .env
  });
};

/**
 * Generate JWT refresh token (90 days)
 * @param {string} userId
 * @returns {string}
 */
export const generateRefreshToken = (userId, sessionId, jti = crypto.randomUUID()) => {
  return jwt.sign({ id: userId, sessionId, jti, typ: "refresh" }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn, // must be "90d" in .env
  });
};

/**
 * Hash a raw refresh token with bcrypt for safe DB storage.
 * @param {string} rawToken
 * @returns {Promise<string>}
 */
const hashRefreshToken = (rawToken) => bcrypt.hash(rawToken, 10);

/**
 * Compare a raw refresh token against a stored bcrypt hash.
 * @param {string} rawToken
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const verifyRefreshTokenHash = (rawToken, hash) =>
  bcrypt.compare(rawToken, hash);

const refreshTokenFingerprint = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

const parseDurationMs = (duration) => {
  if (typeof duration === "number") return duration * 1000;

  const match = /^(\d+)\s*(ms|s|m|h|d)$/i.exec(String(duration || ""));
  if (!match) throw new Error("Invalid JWT refresh expiry configuration");

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};

const getRefreshExpiresAt = () =>
  new Date(Date.now() + parseDurationMs(config.jwt.refreshExpiresIn));

/**
 * Create a new UserSession document after login or token rotation.
 * @param {string} userId
 * @param {string} rawRefreshToken
 * @param {Object} deviceInfo - { deviceId, deviceName, platform, ipAddress }
 * @returns {Promise<void>}
 */
const createSession = async (
  userId,
  sessionId,
  rawRefreshToken,
  refreshTokenJti,
  deviceInfo = {},
  options = {}
) => {
  const hash = await hashRefreshToken(rawRefreshToken);
  const expiresAt = getRefreshExpiresAt();

  const [session] = await UserSession.create([{
    userId,
    sessionId,
    refreshTokenHash: hash,
    refreshTokenJti,
    refreshTokenFingerprint: refreshTokenFingerprint(rawRefreshToken),
    deviceId: deviceInfo.deviceId || null,
    deviceName: deviceInfo.deviceName || "Unknown device",
    platform: deviceInfo.platform || null,
    browser: deviceInfo.browser || null,
    ipAddress: deviceInfo.ipAddress || null,
    lastUsedAt: new Date(),
    expiresAt,
    revokedAt: null,
  }], options);

  return session;
};

export const createAuthenticatedSession = async (userId, deviceInfo = {}) => {
  const sessionId = crypto.randomUUID();
  const refreshTokenJti = crypto.randomUUID();
  const refreshToken = generateRefreshToken(userId, sessionId, refreshTokenJti);
  const session = await createSession(
    userId,
    sessionId,
    refreshToken,
    refreshTokenJti,
    deviceInfo
  );
  const token = generateToken(userId, session.sessionId);

  return { token, refreshToken, session };
};

// ─── Password helpers ─────────────────────────────────────────────────────────

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
 * Remove sensitive fields from user object
 * @param {Object} userObject - User object
 * @returns {Object} User object without sensitive fields
 */
const removeSensitiveFields = (userObject) => {
  const sensitiveFields = [
    "password",
    "otp",
    "otpExpireAt",
    "forgotPasswordOTP",
    "forgotPasswordOTPExpireAt",
    "forgotPasswordOTPVerified",
    "forgotPasswordOTPVerifiedAt",
  ];
  sensitiveFields.forEach((field) => delete userObject[field]);
  return userObject;
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
 * Handles both account verification and forgot password OTP
 * @param {string} email - User email
 * @param {string} type - OTP type: "account" or "password" (optional, auto-detected if not provided)
 * @returns {Promise<Object>} User with new OTP sent
 */
export const resendOTP = async (email, type = null) => {
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
      if (!user.isAccountVerified) {
        type = "account";
      } else if (user.forgotPasswordOTP || user.forgotPasswordOTPExpireAt) {
        type = "password";
      } else {
        // If account is verified and no forgot password OTP exists, check if user is trying to reset password
        // In this case, they should use forgot-password endpoint first
        throw new Error(
          "No active verification code found. Please request a new code"
        );
      }
    }

    // Handle account verification OTP
    if (type === "account") {
      // Check if user is already verified
      if (user.isAccountVerified) {
        throw new Error("Your account is already verified");
      }

      // Generate new OTP
      const otp = generateOTP();
      const otpExpireAt = new Date();
      otpExpireAt.setMinutes(
        otpExpireAt.getMinutes() + config.otp.expireMinutes
      );

      // Update user with new OTP
      user.otp = otp;
      user.otpExpireAt = otpExpireAt;
      await user.save();

      // Send OTP email
      try {
        await sendOTPEmail(user.email, otp);
        logger.info(`Account verification OTP resent to ${user.email}`);
      } catch (emailError) {
        logger.error(`Failed to send OTP email to ${user.email}:`, emailError);
        throw new Error("Failed to send OTP email. Please try again later");
      }

      // Return user without password and OTP
      const userObject = user.toObject();
      delete userObject.password;
      delete userObject.otp;
      delete userObject.forgotPasswordOTP;
      delete userObject.forgotPasswordOTPExpireAt;

      return {
        ...userObject,
        type: "account",
      };
    }

    // Handle forgot password OTP
    if (type === "password") {
      // Check if account is verified
      if (!user.isAccountVerified) {
        throw new Error("Please verify your email address first");
      }

      // Generate new OTP for password reset
      const otp = generateOTP();
      const otpExpireAt = new Date();
      otpExpireAt.setMinutes(
        otpExpireAt.getMinutes() + config.otp.expireMinutes
      );

      // Update user with forgot password OTP and reset verification flags
      user.forgotPasswordOTP = otp;
      user.forgotPasswordOTPExpireAt = otpExpireAt;
      user.forgotPasswordOTPVerified = false;
      user.forgotPasswordOTPVerifiedAt = null;
      await user.save();

      // Send OTP email
      try {
        await sendForgotPasswordOTPEmail(user.email, otp);
        logger.info(`Forgot password OTP resent to ${user.email}`);
      } catch (emailError) {
        logger.error(
          `Failed to send forgot password OTP email to ${user.email}:`,
          emailError
        );
        throw new Error("Failed to send OTP email. Please try again later");
      }

      // Return user without password and OTP
      const userObject = user.toObject();
      delete userObject.password;
      delete userObject.otp;
      delete userObject.forgotPasswordOTP;
      delete userObject.forgotPasswordOTPExpireAt;
      delete userObject.forgotPasswordOTPVerified;
      delete userObject.forgotPasswordOTPVerifiedAt;

      return {
        ...userObject,
        type: "password",
      };
    }

    throw new Error("Invalid OTP type");
  } catch (error) {
    logger.error("Error in resendOTP:", error);
    throw error;
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Login user — creates a new device session and returns both tokens.
 * @param {string} email
 * @param {string} password
 * @param {Object} deviceInfo - { deviceId, deviceName, platform, ipAddress }
 * @returns {Promise<{ user, token, refreshToken }>}
 */
export const loginUser = async (email, password, deviceInfo = {}) => {
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
      // Generate new OTP for account verification
      const otp = generateOTP();
      const otpExpireAt = new Date();
      otpExpireAt.setMinutes(
        otpExpireAt.getMinutes() + config.otp.expireMinutes
      );

      // Update user with new OTP
      user.otp = otp;
      user.otpExpireAt = otpExpireAt;
      await user.save();

      // Send OTP email
      try {
        await sendOTPEmail(user.email, otp);
        logger.info(`OTP sent to unverified user during login attempt: ${user.email}`);
      } catch (emailError) {
        logger.error(
          `Failed to send OTP email to ${user.email}:`,
          emailError
        );
        // Don't throw error - continue with the UnverifiedUser error
      }

      const error = new Error("Please verify your email address first");
      error.errorType = "UnverifiedUser";
      throw error;
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new Error("Invalid email or password");
    }

    const { token, refreshToken } = await createAuthenticatedSession(
      user._id.toString(),
      deviceInfo
    );

    logger.info(`User logged in: ${user.email}`);

    // Return user data without password and OTP
    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.otp;
    delete userObject.otpExpireAt;

    return {
      user: userObject,
      token,
      refreshToken,
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
      // Don't reveal that email doesn't exist - return success message
      throw new Error("No account exists with the provided email.");
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
    return { message: "If an account with this email exists, an OTP has been sent." };
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

    // Revoke ALL sessions — forces re-login on every device
    await revokeAllUserSessions(user._id.toString());

    logger.info(`Password reset successful for ${user.email} — all sessions revoked`);

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

/**
 * Change password (for authenticated users)
 * @param {string} userId - User ID
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Updated user (without password)
 */
export const changePassword = async (userId, oldPassword, newPassword) => {
  try {
    // Find user
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    if (user.isDeleted) {
      throw new Error("User account has been deleted");
    }

    // Verify old password
    const isPasswordValid = await comparePassword(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new Error("Old password is incorrect");
    }

    // Check if new password is same as old password
    const isSamePassword = await comparePassword(newPassword, user.password);

    if (isSamePassword) {
      throw new Error("New password must be different from current password");
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Revoke ALL sessions — forces re-login on every device
    await revokeAllUserSessions(userId);

    logger.info(`Password changed for user ${user.email} — all sessions revoked`);

    return removeSensitiveFields(user.toObject());
  } catch (error) {
    logger.error("Error in changePassword:", error);
    throw error;
  }
};

// ─── Refresh token (with real rotation + reuse detection) ─────────────────────

/**
 * Refresh tokens using a valid refresh token.
 *
 * Flow:
 * 1. Verify the JWT signature/expiry.
 * 2. Find the matching session by userId + hash comparison.
 * 3. If the JWT is valid but NO active session matches → stolen token reuse detected.
 *    Revoke ALL sessions for this user immediately.
 * 4. If a valid session is found → delete it, issue new tokens, store new session hash.
 *    (Sliding expiration: expiresAt resets to now + 90d.)
 *
 * @param {string} rawRefreshToken
 * @param {Object} deviceInfo - { deviceId, deviceName, platform, ipAddress }
 * @returns {Promise<{ token, refreshToken }>}
 */
export const refreshUserToken = async (rawRefreshToken, deviceInfo = {}) => {
  try {
    if (!rawRefreshToken) throw new Error("Refresh token is required");

    let decoded;
    try {
      decoded = jwt.verify(rawRefreshToken, config.jwt.refreshSecret);
    } catch (err) {
      throw new Error("Invalid or expired refresh token");
    }

    const userId = decoded.id;
    const { sessionId, jti, typ } = decoded;

    if (!userId || !sessionId || !jti || typ !== "refresh") {
      throw new Error("Invalid or expired refresh token");
    }

    const tokenFingerprint = refreshTokenFingerprint(rawRefreshToken);
    const mongoSession = await mongoose.startSession();
    let rotatedTokens;

    try {
      await mongoSession.withTransaction(async () => {
        const now = new Date();
        const matchedSession = await UserSession.findOneAndUpdate(
          {
            userId,
            sessionId,
            refreshTokenJti: jti,
            refreshTokenFingerprint: tokenFingerprint,
            revokedAt: null,
            expiresAt: { $gt: now },
          },
          {
            $set: {
              revokedAt: now,
              lastUsedAt: now,
            },
          },
          { new: false, session: mongoSession }
        );

        if (!matchedSession) {
          throw new Error("Suspicious activity detected. Please login again");
        }

        const isMatch = await verifyRefreshTokenHash(
          rawRefreshToken,
          matchedSession.refreshTokenHash
        );
        if (!isMatch) throw new Error("Invalid or expired refresh token");

        const user = await User.findOne(
          { _id: userId, isDeleted: false },
          null,
          { session: mongoSession }
        );
        if (!user) throw new Error("User associated with this token no longer exists");
        if (!user.isAccountVerified) throw new Error("Please verify your email address first");

        const newSessionId = crypto.randomUUID();
        const newRefreshTokenJti = crypto.randomUUID();
        const newRefreshToken = generateRefreshToken(
          userId,
          newSessionId,
          newRefreshTokenJti
        );

        const resolvedDeviceInfo = {
          deviceId: deviceInfo.deviceId || matchedSession.deviceId,
          deviceName: deviceInfo.deviceName || matchedSession.deviceName,
          platform: deviceInfo.platform || matchedSession.platform,
          browser: deviceInfo.browser || matchedSession.browser,
          ipAddress: deviceInfo.ipAddress || matchedSession.ipAddress,
        };

        await createSession(
          userId,
          newSessionId,
          newRefreshToken,
          newRefreshTokenJti,
          resolvedDeviceInfo,
          { session: mongoSession }
        );

        rotatedTokens = {
          token: generateToken(userId, newSessionId),
          refreshToken: newRefreshToken,
          user,
        };
      });
    } catch (error) {
      if (error.message === "Suspicious activity detected. Please login again") {
        logger.warn(
          `Refresh token reuse detected for userId: ${userId} - revoking all sessions`
        );
        await revokeAllUserSessions(userId);
      }
      throw error;
    } finally {
      await mongoSession.endSession();
    }

    logger.info(`Token refreshed for user: ${rotatedTokens.user.email}`);

    return {
      token: rotatedTokens.token,
      refreshToken: rotatedTokens.refreshToken,
    };
  } catch (error) {
    logger.error("Error in refreshUserToken:", error);
    throw error;
  }
};
// ─── Session management ───────────────────────────────────────────────────────

/**
 * Logout a single device session.
 * @param {string} userId
 * @param {string} rawRefreshToken
 * @returns {Promise<void>}
 */
export const logoutUser = async (userId, rawRefreshToken) => {
  try {
    if (!rawRefreshToken) throw new Error("Refresh token is required");

    let decoded;
    try {
      decoded = jwt.verify(rawRefreshToken, config.jwt.refreshSecret);
    } catch (err) {
      logger.info(`Logout called with invalid refresh token for userId: ${userId}`);
      return;
    }

    if (decoded.id !== userId.toString() || decoded.typ !== "refresh") {
      logger.info(`Logout called with mismatched refresh token for userId: ${userId}`);
      return;
    }

    const session = await UserSession.findOne({
      userId,
      sessionId: decoded.sessionId,
      refreshTokenJti: decoded.jti,
      refreshTokenFingerprint: refreshTokenFingerprint(rawRefreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      logger.info(`Logout called with already-invalid token for userId: ${userId}`);
      return;
    }

    const isMatch = await verifyRefreshTokenHash(rawRefreshToken, session.refreshTokenHash);
    if (!isMatch) return;

    await UserSession.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    logger.info(`Session logged out for userId: ${userId}, sessionId: ${session.sessionId}`);
  } catch (error) {
    logger.error("Error in logoutUser:", error);
    throw error;
  }
};
/**
 * Logout a specific session by its MongoDB _id.
 * Used by "remove device" flow.
 * @param {string} userId
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export const logoutSession = async (userId, sessionId) => {
  try {
    const session = await UserSession.findOne({
      sessionId,
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });
    if (!session) throw new Error("Session not found");

    await UserSession.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    logger.info(`Session ${sessionId} removed for userId: ${userId}`);
  } catch (error) {
    logger.error("Error in logoutSession:", error);
    throw error;
  }
};

/**
 * Revoke ALL active sessions for a user (logout all devices).
 * Called after password change/reset and on reuse detection.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export const revokeAllUserSessions = async (userId) => {
  try {
    await UserSession.updateMany(
      { userId, revokedAt: null },
      { revokedAt: new Date() }
    );
    logger.info(`All sessions revoked for userId: ${userId}`);
  } catch (error) {
    logger.error("Error in revokeAllUserSessions:", error);
    throw error;
  }
};

/**
 * Get all active sessions for a user (active devices list).
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export const getUserSessions = async (userId) => {
  try {
    const sessions = await UserSession.find({
      userId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("-refreshTokenHash -refreshTokenFingerprint -refreshTokenJti")
      .sort({ lastUsedAt: -1 });

    return sessions;
  } catch (error) {
    logger.error("Error in getUserSessions:", error);
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
  changePassword,
  refreshUserToken,
  logoutUser,
  logoutSession,
  revokeAllUserSessions,
  getUserSessions,
  generateToken,
  generateRefreshToken,
  createAuthenticatedSession,
  generateOTP,
  hashPassword,
  comparePassword,
};
