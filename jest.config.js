const path = require("path");

module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: ["src/**/*.js", "!src/server.js"],
  coverageDirectory: "coverage",
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetModules: true,
  testTimeout: 15000,
  moduleNameMapper: {
    "^src/(.*)$": path.resolve(__dirname, "src/$1"),
  },
};
