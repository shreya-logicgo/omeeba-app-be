import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(
    ({ timestamp, level, message, ...meta }) =>
      `${timestamp} [${level}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
      }`
  )
);

// Create logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: "omeeba-backend" },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: config.nodeEnv === "development" ? consoleFormat : logFormat,
    }),
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
    }),
    // Write all logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
    }),
  ],
});

export default logger;
