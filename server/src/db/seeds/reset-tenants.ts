/**
 * One-time reset script: deletes all tenants and creates a fresh one with an admin user.
 * Usage: npm run seed:reset-tenants
 *
 * After running, copy the printed UUID into apps/tenant-app/.env as VITE_TENANT_ID.
 */

import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../pool";
import { config } from "../../config/env";

async function run(): Promise<void> {
  console.log("[reset-tenants] Deleting all tenants (CASCADE)...");
  const del = await pool.query("DELETE FROM tenants RETURNING id");
  console.log(`[reset-tenants] Deleted ${del.rowCount} tenant(s).`);

  // tenants.id is UUID after migration 018 — no T- prefix
  const tenantId = uuidv4();
  await pool.query(
    `INSERT INTO tenants (id, name, slug, status, timezone, created_at, updated_at)
     VALUES ($1, 'Test School', 'test-school', 'active', 'Asia/Kolkata', NOW(), NOW())`,
    [tenantId],
  );
  console.log(`[reset-tenants] Created tenant "Test School"`);

  // Seed 8 default school periods (required for timetable + attendance)
  const periods = [
    { n: 1, label: "Period 1", start: "08:00", end: "08:45" },
    { n: 2, label: "Period 2", start: "08:50", end: "09:35" },
    { n: 3, label: "Period 3", start: "09:40", end: "10:25" },
    { n: 4, label: "Period 4", start: "10:30", end: "11:15" },
    { n: 5, label: "Period 5", start: "11:30", end: "12:15" },
    { n: 6, label: "Period 6", start: "12:20", end: "13:05" },
    { n: 7, label: "Period 7", start: "14:00", end: "14:45" },
    { n: 8, label: "Period 8", start: "14:50", end: "15:35" },
  ];
  for (const p of periods) {
    await pool.query(
      `INSERT INTO school_periods (id, tenant_id, period_number, label, start_time, end_time, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
      [uuidv4(), tenantId, p.n, p.label, p.start, p.end],
    );
  }

  // Seed feature flags (disabled by default)
  for (const key of ["timetable", "attendance"]) {
    await pool.query(
      `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
       VALUES ($1, $2, $3, false, NULL)`,
      [`TF-${uuidv4()}`, tenantId, key],
    );
  }

  // Create default admin user
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash("admin123", config.BCRYPT_ROUNDS);
  await pool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, 'Test Admin', 'admin@test.com', $3, '["Admin"]'::jsonb, NOW(), NOW())`,
    [userId, tenantId, passwordHash],
  );
  console.log(
    `[reset-tenants] Created admin  email=admin@test.com  password=admin123`,
  );

  await pool.end();

  console.log("");
  console.log("─────────────────────────────────────────────");
  console.log(`VITE_TENANT_ID=${tenantId}`);
  console.log("─────────────────────────────────────────────");
  console.log(
    "Copy the line above into apps/tenant-app/.env and restart Vite.",
  );
}

run().catch((err) => {
  console.error("[reset-tenants] ERROR:", err);
  process.exit(1);
});
