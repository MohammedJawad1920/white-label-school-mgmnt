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

  // Rate limiting (Freeze §1.5)
  const RATE_LIMIT_ENABLED = process.env["RATE_LIMIT_ENABLED"] !== "false";
  const RATE_LIMIT_WINDOW_MS = parseInt(
    process.env["RATE_LIMIT_WINDOW_MS"] ?? "60000",
    10,
  );
  const RATE_LIMIT_MAX_REQUESTS = parseInt(
    process.env["RATE_LIMIT_MAX_REQUESTS"] ?? "120",
    10,
  );

  // v5.0: Cloudflare R2 (school profile uploads) — optional; empty string disables upload feature
  const R2_ENDPOINT = process.env["R2_ENDPOINT"] ?? "";
  const R2_BUCKET = process.env["R2_BUCKET"] ?? "";
  const R2_ACCESS_KEY_ID = process.env["R2_ACCESS_KEY_ID"] ?? "";
  const R2_SECRET_ACCESS_KEY = process.env["R2_SECRET_ACCESS_KEY"] ?? "";
  // M-07: Public CDN base URL for R2 objects (e.g. https://pub-xxx.r2.dev).
  // When set, returned URLs use the CDN domain instead of the API endpoint.
  const R2_PUBLIC_URL = process.env["R2_PUBLIC_URL"] ?? "";

  // v5.0: Web Push VAPID keys — optional until P2 (push notifications feature)
  const VAPID_PUBLIC_KEY = process.env["VAPID_PUBLIC_KEY"] ?? "";
  const VAPID_PRIVATE_KEY = process.env["VAPID_PRIVATE_KEY"] ?? "";
  const VAPID_SUBJECT = process.env["VAPID_SUBJECT"] ?? "";

  // v5.0: Sentry DSN — optional error tracking
  const SENTRY_DSN = process.env["SENTRY_DSN"] ?? "";

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
    RATE_LIMIT_ENABLED,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS,
    R2_ENDPOINT,
    R2_BUCKET,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_PUBLIC_URL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    SENTRY_DSN,
  } as const;
}

// Runs validation once at import time — process exits if any rule fails
export const config = buildConfig();

export type Config = typeof config;
