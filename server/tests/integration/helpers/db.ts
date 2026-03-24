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
  const id = uuidv4();
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
  const tenantId = uuidv4();
  const tenantSlug = `test-school-${suffix}`;
  const adminPassword = "Admin@Pass123";
  const adminEmail = `admin-${suffix}@test.local`;
  const adminId = uuidv4();
  const periodId = uuidv4();
  // Feature flag IDs — all 10 required per Freeze v6.1 FIX-TEST-001
  const featureIds = {
    timetable: uuidv4(),
    attendance: uuidv4(),
    leave: uuidv4(),
    guardian: uuidv4(),
    notifications: uuidv4(),
    exams: uuidv4(),
    fees: uuidv4(),
    announcements: uuidv4(),
    assignments: uuidv4(),
    import: uuidv4(),
  };

  const featureDefinitions: Array<{
    key:
      | "timetable"
      | "attendance"
      | "leave"
      | "exams"
      | "fees"
      | "announcements"
      | "assignments"
      | "import"
      | "guardian"
      | "notifications";
    name: string;
    description: string;
  }> = [
    {
      key: "timetable",
      name: "Timetable Management",
      description: "Create and manage class schedules with teacher assignments",
    },
    {
      key: "attendance",
      name: "Attendance Tracking",
      description: "Record and view student attendance per class period",
    },
    {
      key: "leave",
      name: "Leave Management",
      description: "Manage leave requests and approvals",
    },
    {
      key: "exams",
      name: "Exam Management",
      description: "Create exams, enter marks, and publish results",
    },
    {
      key: "fees",
      name: "Fees Management",
      description: "Track charges, payments, and balances",
    },
    {
      key: "announcements",
      name: "Announcements",
      description: "Publish announcements to school users",
    },
    {
      key: "assignments",
      name: "Assignments",
      description: "Create and submit assignment work",
    },
    {
      key: "import",
      name: "CSV Import",
      description: "Bulk import school data from CSV files",
    },
    {
      key: "guardian",
      name: "Guardian Portal",
      description: "Guardian-specific views and actions",
    },
    {
      key: "notifications",
      name: "Notifications",
      description: "In-app and push notifications",
    },
  ];

  // Ensure all feature keys exist before inserting tenant_features rows.
  for (const feature of featureDefinitions) {
    await testPool.query(
      `INSERT INTO features (id, key, name, description, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (key) DO NOTHING`,
      [uuidv4(), feature.key, feature.name, feature.description],
    );
  }

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

  // Feature flags — all 10 enabled per Freeze v6.1 FIX-TEST-001
  await testPool.query(
    `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
     VALUES
       ($1, $2, 'timetable', TRUE, NOW()),
       ($3, $2, 'attendance', TRUE, NOW()),
       ($4, $2, 'leave', TRUE, NOW()),
      ($5, $2, 'guardian', TRUE, NOW()),
       ($6, $2, 'notifications', TRUE, NOW()),
       ($7, $2, 'exams', TRUE, NOW()),
       ($8, $2, 'fees', TRUE, NOW()),
       ($9, $2, 'announcements', TRUE, NOW()),
       ($10, $2, 'assignments', TRUE, NOW()),
       ($11, $2, 'import', TRUE, NOW())`,
    [
      featureIds.timetable,
      tenantId,
      featureIds.attendance,
      featureIds.leave,
      featureIds.guardian,
      featureIds.notifications,
      featureIds.exams,
      featureIds.fees,
      featureIds.announcements,
      featureIds.assignments,
      featureIds.import,
    ],
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
 * Includes all v5.0 tables per Freeze v6.1 FIX-TEST-002.
 */
export async function cleanupTenant(tenantId: string): Promise<void> {
  // Phase 2 tables (deepest FK dependencies)
  await testPool.query(
    "DELETE FROM assignment_submissions WHERE tenant_id = $1",
    [tenantId],
  );
  await testPool.query("DELETE FROM assignments WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM exam_results WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query(
    "DELETE FROM exam_student_summaries WHERE tenant_id = $1",
    [tenantId],
  );
  await testPool.query("DELETE FROM exam_subjects WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM exams WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM external_results WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM fee_payments WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM fee_charges WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM announcements WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM notifications WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM push_subscriptions WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM leave_requests WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM student_guardians WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM guardians WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM promotion_logs WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM promotion_previews WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM import_jobs WHERE tenant_id = $1", [
    tenantId,
  ]);

  // Phase 1 tables (original)
  await testPool.query("DELETE FROM attendance_records WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM timeslots WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM students WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM events WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM users WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM school_periods WHERE tenant_id = $1", [
    tenantId,
  ]);
  await testPool.query("DELETE FROM classes WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM batches WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM subjects WHERE tenant_id = $1", [tenantId]);
  await testPool.query("DELETE FROM academic_sessions WHERE tenant_id = $1", [
    tenantId,
  ]);
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
