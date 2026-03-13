/**
 * PostgreSQL Connection Pool
 *
 * WHY a pool singleton: Opening a new connection per request adds ~50–200ms.
 * A pool maintains N open connections and hands them to queries immediately.
 * pg.Pool handles acquire/release automatically — callers just call pool.query().
 *
 * All modules import `pool` from here. Never create a new Pool elsewhere.
 */

import { Pool, PoolClient, types } from "pg";
import { config } from "../config/env";
import { logger } from "../utils/logger";

// Return PostgreSQL DATE columns (OID 1082) as plain YYYY-MM-DD strings.
// Without this, pg creates a JS Date at local midnight, causing a timezone
// day-shift when toISOString() converts it back to UTC on non-UTC servers.
types.setTypeParser(1082, (v: string) => v);

// ── Validate required env vars ───────────────────────────────────────────────
// DATABASE_URL is validated by config/env.ts at startup — no need to re-check here.

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  min: config.DATABASE_POOL_MIN,
  max: config.DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  ssl:
    config.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
});

// Log pool-level errors without crashing the process
pool.on("error", (err: Error) => {
  logger.error({ err, action: "db.pool.error" }, err.message);
});

// Verify connection on startup
// NOTE: @types/pg defines this callback as (err: Error | undefined, ...)
// NOT (err: Error | null, ...) — using null here causes TS2345
pool.connect(
  (
    err: Error | undefined,
    client: PoolClient | undefined,
    release: (err?: Error) => void,
  ) => {
    if (err) {
      logger.error({ err, action: "db.connect.failed" }, err.message);
      process.exit(1);
    }
    logger.info({ action: "db.connected" }, "PostgreSQL connected");
    release();
  },
);

/**
 * withTransaction — runs multiple queries atomically.
 *
 * WHY: Operations like tenant creation + seeding 8 default periods must either
 * all succeed or all roll back. This helper manages BEGIN/COMMIT/ROLLBACK so
 * service code doesn't have to.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * checkDbConnection — used by /health endpoint
 */
export async function checkDbConnection(): Promise<void> {
  const result = await pool.query<{ now: Date }>("SELECT NOW()");
  if (!result.rows[0]) {
    throw new Error("Database health check returned no rows");
  }
}

/**
 * closePool — gracefully drains all idle/active clients.
 * Called in tests' globalTeardown so Jest exits cleanly and the
 * OS releases connections before the next run or the dev server starts.
 */
export async function closePool(): Promise<void> {
  await pool.end();
}
