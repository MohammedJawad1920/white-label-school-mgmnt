/**
 * globalSetup — runs once before all integration test suites.
 *
 * Loads .env so that DATABASE_URL (or TEST_DATABASE_URL) is available
 * to all test workers. Also validates that a DB connection can be
 * established — fails fast rather than having each suite time out.
 *
 * WHY separate from per-suite beforeAll hooks:
 * globalSetup runs in a different Node.js context (no module sharing),
 * so it only does the minimum needed: env loading + DB ping.
 */
import dotenv from "dotenv";
import { Pool } from "pg";
import path from "path";

export default async function globalSetup(): Promise<void> {
  // Load .env from repo root (server/.env or server/.env.test)
  const envFile = process.env["NODE_ENV"] === "test" ? ".env.test" : ".env";
  dotenv.config({ path: path.resolve(__dirname, "../../..", envFile) });
  dotenv.config({ path: path.resolve(__dirname, "../..", envFile) });

  const dbUrl = process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];

  if (!dbUrl) {
    console.warn(
      "[globalSetup] No DATABASE_URL or TEST_DATABASE_URL found — " +
        "integration tests will be skipped.",
    );
    return;
  }

  // Ping the DB to fail fast
  const pool = new Pool({ connectionString: dbUrl });
  try {
    await pool.query("SELECT 1");
    console.log("[globalSetup] DB connection verified.");
  } catch (err) {
    console.error(
      "[globalSetup] DB connection failed:",
      (err as Error).message,
    );
    throw err;
  } finally {
    await pool.end();
  }
}
