import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Path to Next.js app to load next.config.js and .env files
  dir: "./",
});

const customJestConfig: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@testing/(.*)$": "<rootDir>/testing/$1",
  },
  testMatch: [
    "<rootDir>/testing/**/*.test.{ts,tsx,js,jsx}",
    "<rootDir>/testing/**/*.spec.{ts,tsx,js,jsx}",
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!(.*)/)",
  ],
};

export default createJestConfig(customJestConfig);
