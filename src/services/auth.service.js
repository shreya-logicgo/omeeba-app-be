/**
 * Auth Service
 * Business logic for authentication
 */

import bcrypt from "bcryptjs";
import User from "../models/users/User.js";
import { sendOTPEmail } from "./email.service.js";
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
      throw new Error("User with this email already exists");
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
          throw new Error("User with this phone number already exists");
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
          throw new Error("Username already taken");
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
        throw new Error("User with this phone number already exists");
      }
    }

    // Check if username already exists (only for new registrations)
    const existingUserByUsername = await User.findOne({
      username: username.toLowerCase(),
      isDeleted: false,
    });

    if (existingUserByUsername) {
      throw new Error("Username already taken");
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

export default {
  registerUser,
  generateOTP,
  hashPassword,
  comparePassword,
};
