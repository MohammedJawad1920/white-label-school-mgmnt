/**
 * globalTeardown — runs once after all integration test suites.
 * Nothing to do here since each suite cleans up its own tenant data.
 * Kept as a placeholder for future needs (e.g., closing a shared pool).
 */
export default async function globalTeardown(): Promise<void> {
  // no-op
}
