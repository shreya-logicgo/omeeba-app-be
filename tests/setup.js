/**
 * Test Setup File
 * This file runs before all tests
 *
 * Note: NODE_ENV should be set to "test" in jest.config.js or package.json test script
 * This ensures env.js automatically uses MONGODB_URI_TEST
 */

import { connectDB, disconnectDB } from "../src/config/database.js";

// Setup before all tests
beforeAll(async () => {
  // connectDB() will automatically use MONGODB_URI_TEST
  // because env.js checks NODE_ENV === "test"
  // NODE_ENV is set to "test" in jest.config.js or package.json test script
  await connectDB();
});

// Cleanup after all tests
afterAll(async () => {
  await disconnectDB();
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const { default: mongoose } = await import("mongoose");
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});
