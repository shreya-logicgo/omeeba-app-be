/**
 * Environment Configuration
 *
 * This is the ONLY file that should access process.env directly.
 * All environment variables are validated using Joi.
 *
 */

import Joi from "joi";
import dotenv from "dotenv";
import enums from "../constants/enums.js";

// Determine node environment
const nodeEnv = process.env.NODE_ENV || enums.nodeEnvEnums.DEVELOPMENT;

// Load environment variables based on environment
// Priority: .env.dev (development) or .env (other), with fallback to .env
let dotenvResult;
if (nodeEnv === enums.nodeEnvEnums.DEVELOPMENT) {
  // Try .env.dev first, fallback to .env if not found
  dotenvResult = dotenv.config({ path: ".env.dev" });
  if (dotenvResult.error && dotenvResult.error.code === "ENOENT") {
    // .env.dev doesn't exist, use .env
    dotenvResult = dotenv.config({ path: ".env" });
  }
} else {
  // Production, test, staging - use .env
  dotenvResult = dotenv.config({ path: ".env" });
}

// Log which env file was loaded (only in development)
if (nodeEnv === enums.nodeEnvEnums.DEVELOPMENT) {
  console.log(
    `Environment: ${nodeEnv}, Loaded from: ${
      dotenvResult.error ? ".env (fallback)" : ".env.dev"
    }`
  );
}

// Joi schema for environment variables validation
const envVarsSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string()
    .valid(
      enums.nodeEnvEnums.DEVELOPMENT,
      enums.nodeEnvEnums.PRODUCTION,
      enums.nodeEnvEnums.TEST,
      enums.nodeEnvEnums.STAGING
    )
    .default(enums.nodeEnvEnums.DEVELOPMENT),
  PORT: Joi.number().default(3000),
  API_VERSION: Joi.string().default("v1"),

  // Database Configuration
  MONGODB_URI: Joi.string()
    .trim()
    .default("mongodb://localhost:27017/omeeba")
    .description("MongoDB connection URL"),
  MONGODB_URI_TEST: Joi.string()
    .trim()
    .default("mongodb://localhost:27017/omeeba_test")
    .description("MongoDB test database URL"),

  // JWT Configuration
  JWT_SECRET: Joi.string()
    .default("your-secret-key-change-in-production")
    .description("JWT secret key"),
  JWT_EXPIRE: Joi.string().default("7d"),
  JWT_REFRESH_SECRET: Joi.string()
    .default("your-refresh-secret-change-in-production")
    .description("JWT refresh secret key"),
  JWT_REFRESH_EXPIRE: Joi.string().default("30d"),

  // Bcrypt Configuration
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),

  // File Upload Configuration
  MAX_FILE_SIZE: Joi.number().default(10485760), // 10MB
  UPLOAD_PATH: Joi.string().default("./uploads"),

  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: Joi.string().optional(),
  CLOUDINARY_API_KEY: Joi.string().optional(),
  CLOUDINARY_API_SECRET: Joi.string().optional(),

  // AWS S3 Configuration
  AWS_ACCESS_KEY_ID: Joi.string().optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().optional(),
  AWS_REGION: Joi.string().default("us-east-1"),
  AWS_S3_BUCKET: Joi.string().optional(),
  AWS_S3_ENDPOINT: Joi.string().optional(),

  // DigitalOcean Spaces Configuration
  DIGITAL_OCEAN_DIRNAME: Joi.string().optional(),
  DIGITAL_OCEAN_SPACES_SECRET_KEY: Joi.string().optional(),
  DIGITAL_OCEAN_SPACES_ACCESS_KEY: Joi.string().optional(),
  DIGITAL_OCEAN_ENDPOINT: Joi.string().optional(),
  DIGITAL_OCEAN_SPACES_BASE_URL: Joi.string().optional(),
  DIGITAL_OCEAN_SPACES_REGION: Joi.string().optional(),
  DIGITAL_OCEAN_BUCKET_NAME: Joi.string().optional(),

  // Email Configuration (Brevo)
  BREVO_API_KEY: Joi.string().optional().allow("").description("Brevo API key"),
  FROM_EMAIL: Joi.string().default("noreply@omeeba.com"),
  FROM_NAME: Joi.string().default("Omeeba"),

  // CORS Configuration
  ALLOWED_ORIGINS: Joi.string().default("http://localhost:3000"),

  // Logging Configuration
  LOG_LEVEL: Joi.string()
    .valid("error", "warn", "info", "debug")
    .default("info"),
  LOG_FILE: Joi.string().default("./logs/app.log"),

  // OTP Configuration
  OTP_EXPIRE_MINUTES: Joi.number().default(10),
  OTP_LENGTH: Joi.number().default(6),

  // Pagination Configuration
  DEFAULT_PAGE_SIZE: Joi.number().default(20),
  MAX_PAGE_SIZE: Joi.number().default(100),

  // Share Configuration
  SHARE_BASE_URL: Joi.string()
    .uri()
    .default("https://omeeba.app/share")
    .description("Base URL for shareable content links"),
})
  .unknown()
  .prefs({ errors: { label: "key" } });

// Validate environment variables
const { value: envVars, error } = envVarsSchema.validate(process.env, {
  abortEarly: false,
});

// Throw error if validation fails
if (error) {
  const errorMessage = error.details
    .map((detail) => `${detail.path.join(".")}: ${detail.message}`)
    .join(", ");
  throw new Error(`Environment variable validation error: ${errorMessage}`);
}

export default {
  port: envVars.PORT,
  nodeEnv: nodeEnv,
  apiVersion: envVars.API_VERSION,
  mongodb: {
    url:
      nodeEnv === enums.nodeEnvEnums.TEST
        ? envVars.MONGODB_URI_TEST ||
          envVars.MONGODB_URI ||
          "mongodb://localhost:27017/omeeba_test"
        : envVars.MONGODB_URI || "mongodb://localhost:27017/omeeba",
    testUrl:
      envVars.MONGODB_URI_TEST || "mongodb://localhost:27017/omeeba_test",
    options: {},
  },
  jwt: {
    secretKey: envVars.JWT_SECRET,
    expiresIn: envVars.JWT_EXPIRE,
    refreshSecret: envVars.JWT_REFRESH_SECRET,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRE,
  },
  bcrypt: {
    saltRounds: envVars.BCRYPT_SALT_ROUNDS,
  },
  fileUpload: {
    maxFileSize: envVars.MAX_FILE_SIZE,
    uploadPath: envVars.UPLOAD_PATH,
  },
  cloudinary: {
    cloudName: envVars.CLOUDINARY_CLOUD_NAME,
    apiKey: envVars.CLOUDINARY_API_KEY,
    apiSecret: envVars.CLOUDINARY_API_SECRET,
  },
  aws: {
    accessKeyId: envVars.AWS_ACCESS_KEY_ID,
    secretAccessKey: envVars.AWS_SECRET_ACCESS_KEY,
    region: envVars.AWS_REGION,
    s3Bucket: envVars.AWS_S3_BUCKET,
    s3Endpoint: envVars.AWS_S3_ENDPOINT,
  },
  digitalOcean: {
    dirname: envVars.DIGITAL_OCEAN_DIRNAME,
    accessKey: envVars.DIGITAL_OCEAN_SPACES_ACCESS_KEY,
    secretKey: envVars.DIGITAL_OCEAN_SPACES_SECRET_KEY,
    endpoint: envVars.DIGITAL_OCEAN_ENDPOINT,
    baseUrl: envVars.DIGITAL_OCEAN_SPACES_BASE_URL,
    region: envVars.DIGITAL_OCEAN_SPACES_REGION,
    bucketName: envVars.DIGITAL_OCEAN_BUCKET_NAME,
  },
  brevo: {
    apiKey: envVars.BREVO_API_KEY,
  },
  email: {
    from: envVars.FROM_EMAIL,
    fromName: envVars.FROM_NAME,
  },
  cors: {
    origins: envVars.ALLOWED_ORIGINS
      ? envVars.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : ["http://localhost:3000"],
  },
  logging: {
    level: envVars.LOG_LEVEL,
    file: envVars.LOG_FILE,
  },
  otp: {
    expireMinutes: envVars.OTP_EXPIRE_MINUTES,
    length: envVars.OTP_LENGTH,
  },
  pagination: {
    defaultPageSize: envVars.DEFAULT_PAGE_SIZE,
    maxPageSize: envVars.MAX_PAGE_SIZE,
  },
  share: {
    baseUrl: envVars.SHARE_BASE_URL,
  },
};

// Export individual variables for backward compatibility
export const NODE_ENV = nodeEnv;
export const PORT = envVars.PORT;
export const API_VERSION = envVars.API_VERSION;
export const MONGODB_URI =
  nodeEnv === enums.nodeEnvEnums.TEST
    ? envVars.MONGODB_URI_TEST || envVars.MONGODB_URI
    : envVars.MONGODB_URI;
export const MONGODB_URI_TEST = envVars.MONGODB_URI_TEST;
export const JWT_SECRET = envVars.JWT_SECRET;
export const JWT_EXPIRE = envVars.JWT_EXPIRE;
export const JWT_REFRESH_SECRET = envVars.JWT_REFRESH_SECRET;
export const JWT_REFRESH_EXPIRE = envVars.JWT_REFRESH_EXPIRE;
export const BCRYPT_SALT_ROUNDS = envVars.BCRYPT_SALT_ROUNDS;
export const MAX_FILE_SIZE = envVars.MAX_FILE_SIZE;
export const UPLOAD_PATH = envVars.UPLOAD_PATH;
export const CLOUDINARY_CLOUD_NAME = envVars.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = envVars.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = envVars.CLOUDINARY_API_SECRET;
export const BREVO_API_KEY = envVars.BREVO_API_KEY;
export const FROM_EMAIL = envVars.FROM_EMAIL;
export const FROM_NAME = envVars.FROM_NAME;
export const CORS_ORIGINS = envVars.ALLOWED_ORIGINS
  ? envVars.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:3000"];
export const LOG_LEVEL = envVars.LOG_LEVEL;
export const LOG_FILE = envVars.LOG_FILE;
export const OTP_EXPIRE_MINUTES = envVars.OTP_EXPIRE_MINUTES;
export const OTP_LENGTH = envVars.OTP_LENGTH;
export const DEFAULT_PAGE_SIZE = envVars.DEFAULT_PAGE_SIZE;
export const MAX_PAGE_SIZE = envVars.MAX_PAGE_SIZE;
export const SHARE_BASE_URL = envVars.SHARE_BASE_URL;
