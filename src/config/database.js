import mongoose from "mongoose";
import logger from "../utils/logger.js";
import config from "./env.js";

/**
 * Connect to MongoDB database
 * @returns {Promise} - Connection promise
 */
export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.mongodb.url);

    if (config.nodeEnv === "development") {
      logger.info(`MongoDB Connected: ${conn.connection.host}`);
    }

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    return conn;
  } catch (error) {
    logger.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
};

/**
 * Disconnect from MongoDB database
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB Disconnected");
  } catch (error) {
    logger.error(`Error disconnecting: ${error.message}`);
    throw error;
  }
};

export default { connectDB, disconnectDB };
