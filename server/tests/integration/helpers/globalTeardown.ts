/**
 * globalTeardown — runs once after all integration test suites.
 *
 * Closes both the test helper pool (testPool) and the production app pool
 * so Jest exits cleanly and PostgreSQL connections are freed immediately.
 *
 * WHY this matters: without explicit pool.end() calls, idle connections
 * accumulate across repeated test runs. Combined with the dev server's own
 * pool, this quickly exhausts PostgreSQL's max_connections, causing
 * "sorry, too many clients already" errors that crash the dev server.
 */
import { closePool as closeTestPool } from "./db";
import { closePool as closeAppPool } from "../../../src/db/pool";

export default async function globalTeardown(): Promise<void> {
  await Promise.allSettled([closeTestPool(), closeAppPool()]);
}
