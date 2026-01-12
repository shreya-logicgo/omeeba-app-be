import dotenv from "dotenv";

dotenv.config();

export const NODE_ENV = process.env.NODE_ENV || "development";
export const PORT = parseInt(process.env.PORT, 10) || 3000;
export const API_VERSION = process.env.API_VERSION || "v1";

// Database
export const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/omeeba";
export const MONGODB_URI_TEST =
  process.env.MONGODB_URI_TEST || "mongodb://localhost:27017/omeeba_test";

// JWT
export const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
export const JWT_EXPIRE = process.env.JWT_EXPIRE || "7d";
export const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret";
export const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || "30d";

// Bcrypt
export const BCRYPT_SALT_ROUNDS = parseInt(
  process.env.BCRYPT_SALT_ROUNDS,
  10
) || 12;

// File Upload
export const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760; // 10MB
export const UPLOAD_PATH = process.env.UPLOAD_PATH || "./uploads";

// Cloudinary
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Email
export const SMTP_HOST = process.env.SMTP_HOST;
export const SMTP_PORT = parseInt(process.env.SMTP_PORT, 10) || 587;
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@omeeba.com";

// CORS
export const CORS_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:3000"];

// Logging
export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const LOG_FILE = process.env.LOG_FILE || "./logs/app.log";

// OTP
export const OTP_EXPIRE_MINUTES = parseInt(
  process.env.OTP_EXPIRE_MINUTES,
  10
) || 10;
export const OTP_LENGTH = parseInt(process.env.OTP_LENGTH, 10) || 6;

// Pagination
export const DEFAULT_PAGE_SIZE = parseInt(
  process.env.DEFAULT_PAGE_SIZE,
  10
) || 20;
export const MAX_PAGE_SIZE = parseInt(process.env.MAX_PAGE_SIZE, 10) || 100;

