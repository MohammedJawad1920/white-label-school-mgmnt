/**
 * Jest config for integration tests.
 *
 * These tests hit the real PostgreSQL DB (or a test DB specified by
 * TEST_DATABASE_URL env var). They require:
 *   - A running PostgreSQL instance
 *   - All 4 migrations applied (001–004)
 *   - DATABASE_URL (or TEST_DATABASE_URL) set in .env or environment
 *
 * Run:  npx jest --config jest.config.integration.ts --runInBand
 * Or:   npm run test:integration
 *
 * WHY --runInBand: Each suite creates unique tenant data, but concurrent
 * writes to a shared DB can exhaust the connection pool and cause flaky tests.
 */
import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/integration"],
  moduleFileExtensions: ["ts", "js", "json"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tests/tsconfig.json" }],
  },
  clearMocks: true,
  testTimeout: 30_000,
  // Serial execution to avoid connection pool exhaustion against shared DB
  maxWorkers: 1,
  // Load .env before running tests
  globalSetup: "<rootDir>/tests/integration/helpers/globalSetup.ts",
  globalTeardown: "<rootDir>/tests/integration/helpers/globalTeardown.ts",
};

export default config;
