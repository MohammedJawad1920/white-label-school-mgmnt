/**
 * Environment Configuration & Validation
 *
 * WHY: Fail fast at startup rather than fail mysteriously at runtime.
 * If a required env var is missing or malformed, the process exits with
 * a clear error message before any connections are established.
 *
 * Rules from Freeze §1.5:
 * - JWT_SECRET >= 32 characters (256-bit)
 * - DATABASE_URL must be postgresql:// format
 * - BCRYPT_ROUNDS must be 10–12
 * - NODE_ENV must be development | production | test
 * - JWT_EXPIRES_IN must be >= 7d
 */

import dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function validateJwtExpiresIn(value: string): void {
  const match = /^(\d+)d$/.exec(value);
  if (!match) {
    throw new Error(
      `JWT_EXPIRES_IN must be in format "Nd" (e.g. "7d", "365d"). Got: ${value}`,
    );
  }
  const days = parseInt(match[1] ?? "0", 10);
  if (days < 7) {
    throw new Error(`JWT_EXPIRES_IN must be at least 7d. Got: ${value}`);
  }
}

function validateDatabaseUrl(url: string): void {
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(
      `DATABASE_URL must use PostgreSQL format (postgresql://...). Got prefix: ${url.slice(0, 20)}`,
    );
  }
}

function validateNodeEnv(
  value: string,
): asserts value is "development" | "production" | "test" {
  const allowed = ["development", "production", "test"];
  if (!allowed.includes(value)) {
    throw new Error(
      `NODE_ENV must be one of: ${allowed.join(", ")}. Got: ${value}`,
    );
  }
}

function validateBcryptRounds(value: string): number {
  const rounds = parseInt(value, 10);
  if (isNaN(rounds) || rounds < 10 || rounds > 12) {
    throw new Error(`BCRYPT_ROUNDS must be between 10–12. Got: ${value}`);
  }
  return rounds;
}

function validateJwtSecret(value: string): void {
  if (value.length < 32) {
    throw new Error(
      `JWT_SECRET must be at least 32 characters. Got length: ${value.length}`,
    );
  }
}

function buildConfig() {
  const NODE_ENV = requireEnv("NODE_ENV");
  validateNodeEnv(NODE_ENV);

  const DATABASE_URL = requireEnv("DATABASE_URL");
  validateDatabaseUrl(DATABASE_URL);

  const JWT_SECRET = requireEnv("JWT_SECRET");
  validateJwtSecret(JWT_SECRET);

  const JWT_EXPIRES_IN = requireEnv("JWT_EXPIRES_IN");
  validateJwtExpiresIn(JWT_EXPIRES_IN);

  const BCRYPT_ROUNDS = validateBcryptRounds(requireEnv("BCRYPT_ROUNDS"));

  const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
  const DATABASE_POOL_MIN = parseInt(
    process.env["DATABASE_POOL_MIN"] ?? "2",
    10,
  );
  const DATABASE_POOL_MAX = parseInt(
    process.env["DATABASE_POOL_MAX"] ?? "10",
    10,
  );
  const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";

  return {
    NODE_ENV,
    PORT,
    DATABASE_URL,
    DATABASE_POOL_MIN,
    DATABASE_POOL_MAX,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    BCRYPT_ROUNDS,
    ALLOWED_ORIGINS,
    LOG_LEVEL,
  } as const;
}

// Runs validation once at import time — process exits if any rule fails
export const config = buildConfig();

export type Config = typeof config;
