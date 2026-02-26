/**
 * SuperAdmin Seed Script
 *
 * WHY no API endpoint: Freeze §1 explicitly bans a SuperAdmin registration
 * endpoint. The only way to create the first SuperAdmin is this one-time
 * DB script run manually by a platform operator.
 *
 * Usage:
 *   npm run seed:superadmin
 *
 * Safe to re-run — checks if the email already exists before inserting.
 * Credentials can be overridden via env vars before running:
 *   SA_SEED_EMAIL=myemail@platform.com SA_SEED_PASSWORD=MyPass123 npm run seed:superadmin
 */

import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { pool } from "../pool";
import { config } from "../../config/env";

const SEED_EMAIL = process.env["SA_SEED_EMAIL"] ?? "admin@platform.com";
const SEED_PASSWORD = process.env["SA_SEED_PASSWORD"] ?? "SuperAdmin@123";
const SEED_NAME = process.env["SA_SEED_NAME"] ?? "Platform Admin";

async function seed(): Promise<void> {
  console.log("[seed:superadmin] Starting...");

  // Check if already seeded — idempotent
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM superadmins WHERE email = $1",
    [SEED_EMAIL.toLowerCase()],
  );

  if ((existing.rowCount ?? 0) > 0) {
    console.log(
      `[seed:superadmin] SuperAdmin "${SEED_EMAIL}" already exists. Skipping.`,
    );
    return;
  }

  const id = `SA-${uuidv4()}`;
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, config.BCRYPT_ROUNDS);

  await pool.query(
    `INSERT INTO superadmins (id, name, email, password_hash, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())`,
    [id, SEED_NAME, SEED_EMAIL.toLowerCase(), passwordHash],
  );

  console.log("[seed:superadmin] ✅ SuperAdmin created");
  console.log(`   ID:    ${id}`);
  console.log(`   Email: ${SEED_EMAIL}`);
  console.log(`   Name:  ${SEED_NAME}`);
  console.log("   ⚠️  Change the password immediately in production.");
}

seed()
  .catch((err) => {
    console.error("[seed:superadmin] Fatal:", err);
    process.exit(1);
  })
  .finally(() => pool.end());
