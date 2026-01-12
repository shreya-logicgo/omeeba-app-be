export default {
  testEnvironment: "node",
  transform: {},
  moduleFileExtensions: ["js", "json"],
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/server.js",
    "!src/app.js",
    "!**/node_modules/**",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  verbose: true,
  // Set NODE_ENV to test for all test runs
  // This ensures env.js uses MONGODB_URI_TEST automatically
  testEnvironmentOptions: {
    NODE_ENV: "test",
  },
};
