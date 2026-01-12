const mongoose = require("mongoose");

/**
 * Connect to MongoDB database
 * @param {string} mongoURI - MongoDB connection string
 * @returns {Promise} - Connection promise
 */
const connectDB = async (mongoURI) => {
  try {
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB database
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log("MongoDB Disconnected");
  } catch (error) {
    console.error(`Error disconnecting: ${error.message}`);
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
