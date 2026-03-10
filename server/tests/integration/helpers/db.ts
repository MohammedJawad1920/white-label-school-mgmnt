/**
 * DB test helpers.
 *
 * Provides:
 *   - testPool         — raw pg pool for seeding/asserting
 *   - seedSuperAdmin   — creates a test superadmin (idempotent)
 *   - createTestTenant — creates an isolated tenant + admin user + 1 period
 *   - cleanupTenant    — hard-deletes all tenant rows (cascade)
 *   - makeApp          — returns a fresh supertest-wrapped Express app
 *   - skipIfNoDb       — helper to skip a suite when no DATABASE_URL set
 *
 * WHY hard-delete in cleanup: These are test-only tenants identified by a
 * unique UUID prefix. Hard delete keeps the test DB clean between runs
 * without polluting soft-delete rows.
 */
import dotenv from "dotenv";
import path from "path";

// Load .env before importing pool (pool.ts reads env on module load)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env.test") });

// Override DATABASE_URL with TEST_DATABASE_URL if provided
if (process.env["TEST_DATABASE_URL"]) {
  process.env["DATABASE_URL"] = process.env["TEST_DATABASE_URL"];
}

import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import supertest from "supertest";
import { createApp } from "../../../src/app";

export const testPool = new Pool({
  connectionString:
    process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"],
  max: 5,
});

// ── Skip guard ───────────────────────────────────────────────────────────────
export function skipIfNoDb(): boolean {
  const url =
    process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"] ?? "";
  return !url;
}

// ── SuperAdmin seed ──────────────────────────────────────────────────────────
export const SA_EMAIL = "test-sa@platform-test.com";
export const SA_PASSWORD = "TestSuperAdmin@123";

export async function seedSuperAdmin(): Promise<string> {
  const existing = await testPool.query<{ id: string }>(
    "SELECT id FROM superadmins WHERE email = $1",
    [SA_EMAIL],
  );
  if ((existing.rowCount ?? 0) > 0) {
    return existing.rows[0]!.id;
  }
  const id = `SA-T-${uuidv4()}`;
  const hash = await bcrypt.hash(SA_PASSWORD, 10);
  await testPool.query(
    `INSERT INTO superadmins (id, name, email, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [id, "Test SuperAdmin", SA_EMAIL, hash],
  );
  return id;
}

export async function cleanupSuperAdmin(): Promise<void> {
  await testPool.query("DELETE FROM superadmins WHERE email = $1", [SA_EMAIL]);
}

// ── Tenant helpers ───────────────────────────────────────────────────────────
export interface TestTenant {
  tenantId: string;
  tenantSlug: string;
  adminId: string;
  adminEmail: string;
  adminPassword: string;
  /** A seeded school period */
  periodId: string;
  periodNumber: number;
}

/**
 * Creates a fully isolated test tenant including:
 *   - tenants row
 *   - 1 admin user row
 *   - 1 school period row
 *   - timetable + attendance feature flags (both enabled)
 */
export async function createTestTenant(): Promise<TestTenant> {
  const suffix = uuidv4().replace(/-/g, "").slice(0, 8);
  const tenantId = `T-TEST-${suffix}`;
  const tenantSlug = `test-school-${suffix}`;
  const adminPassword = "Admin@Pass123";
  const adminEmail = `admin-${suffix}@test.local`;
  const adminId = `U-ADM-${suffix}`;
  const periodId = `SP-${suffix}`;

  // Tenant
  await testPool.query(
    `INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())`,
    [tenantId, `Test School ${suffix}`, tenantSlug],
  );

  // Admin user
  const hash = await bcrypt.hash(adminPassword, 10);
  await testPool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Admin"]'::jsonb, NOW(), NOW())`,
    [adminId, tenantId, "Test Admin", adminEmail, hash],
  );

  // School period (underscore table name per migration 001)
  await testPool.query(
    `INSERT INTO school_periods (id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at)
     VALUES ($1, $2, $3, $4, '08:00', '08:45', NOW(), NOW())`,
    [periodId, tenantId, 1, "Period 1"],
  );

  // Feature flags — both enabled so timetable + attendance routes work
  await testPool.query(
    `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
     VALUES
       ($1, $2, 'timetable', TRUE, NOW()),
       ($3, $2, 'attendance', TRUE, NOW())`,
    [`TF-TT-${suffix}`, tenantId, `TF-AT-${suffix}`],
  );

  return {
    tenantId,
    tenantSlug,
    adminId,
    adminEmail,
    adminPassword,
    periodId,
    periodNumber: 1,
  };
}

/**
 * Hard-deletes all rows for a test tenant (reverse FK order).
 * Safe to call in afterAll even if some rows were not created.
 */
export async function cleanupTenant(tenantId: string): Promise<void> {
  await testPool.query("DELETE FROM attendance_records WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM timeslots WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM students WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM school_periods WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM classes WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM batches WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM subjects WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM events WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM tenant_features WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
}

// ── Supertest app ─────────────────────────────────────────────────────────────
/** Returns a supertest agent wrapping a fresh Express app. */
export function makeAgent() {
  return supertest(createApp());
}

// ── Close pool ────────────────────────────────────────────────────────────────
export async function closePool(): Promise<void> {
  await testPool.end();
}
