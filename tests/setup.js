import { connectDB, disconnectDB } from "../src/config/database.js";
import { MONGODB_URI_TEST } from "../src/config/env.js";

// Setup before all tests
beforeAll(async () => {
  // Connect to test database
  process.env.MONGODB_URI = MONGODB_URI_TEST;
  await connectDB();
});

// Cleanup after all tests
afterAll(async () => {
  await disconnectDB();
});

// Cleanup after each test
afterEach(async () => {
  // Clear all collections
  const { mongoose } = await import("mongoose");
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

