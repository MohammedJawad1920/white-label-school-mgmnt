/**
 * One-time reset script: deletes all tenants and creates a fresh one with an admin user.
 * Usage: npx ts-node -r dotenv/config src/db/seeds/reset-tenants.ts
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

  const tenantId = `T-${uuidv4()}`;
  await pool.query(
    `INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', NOW(), NOW())`,
    [tenantId, "Test School", "test-school"],
  );
  console.log(`[reset-tenants] Created tenant "Test School" (id: ${tenantId})`);

  const userId = `U-${uuidv4()}`;
  const passwordHash = await bcrypt.hash("admin123", config.BCRYPT_ROUNDS);
  await pool.query(
    `INSERT INTO users (id, tenant_id, name, email, password_hash, roles, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, '["Admin"]'::jsonb, NOW(), NOW())`,
    [userId, tenantId, "Test Admin", "admin@test.com", passwordHash],
  );
  console.log(
    `[reset-tenants] Created admin user "Test Admin" <admin@test.com>`,
  );

  await pool.end();
  console.log("[reset-tenants] Done.");
}

run().catch((err) => {
  console.error("[reset-tenants] ERROR:", err);
  process.exit(1);
});
