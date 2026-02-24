const bcrypt = require("bcrypt");
const db = require("../config/database");
require("dotenv").config();

async function seedTestData() {
  try {
    console.log("Wiping existing test data...");

    await db.query(`DELETE FROM attendance_records WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM time_slots        WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM students          WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM classes           WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM subjects          WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM users             WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM batches           WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM tenant_features   WHERE tenant_id = 'T001'`);
    await db.query(`DELETE FROM tenants           WHERE id = 'T001'`);

    console.log("Wiped. Seeding fresh data...");

    // 1. Tenant
    await db.query(
      `INSERT INTO tenants (id, name, slug) VALUES ('T001', 'Test School', 'test-school')`,
    );
    console.log("✓ Tenant");

    // 2. Admin
    const adminHash = await bcrypt.hash("admin123", 10);
    await db.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        "ADMIN001",
        "T001",
        "Admin User",
        "admin@test.com",
        adminHash,
        '["Admin"]',
      ],
    );
    console.log("✓ Admin    admin@test.com / admin123");

    // 3. Teacher (U001 — referenced by other test scripts)
    const teacherHash = await bcrypt.hash("password123", 10);
    await db.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        "U001",
        "T001",
        "Test Teacher",
        "teacher@test.com",
        teacherHash,
        '["Teacher"]',
      ],
    );
    console.log("✓ Teacher  teacher@test.com / password123");

    // 4. Batch
    await db.query(
      `INSERT INTO batches (id, tenant_id, name, start_year, end_year)
       VALUES ('B001', 'T001', '2025-2026', 2025, 2026)`,
    );
    console.log("✓ Batch    2025-2026 (B001)");

    // 5. Class
    await db.query(
      `INSERT INTO classes (id, tenant_id, name, batch_id)
       VALUES ('C001', 'T001', 'Grade 10A', 'B001')`,
    );
    console.log("✓ Class    Grade 10A (C001)");

    // 6. Subject
    await db.query(
      `INSERT INTO subjects (id, tenant_id, name, code)
       VALUES ('SUB001', 'T001', 'Mathematics', 'MATH101')`,
    );
    console.log("✓ Subject  Mathematics / MATH101 (SUB001)");

    console.log("\nSeeded successfully!");
    console.log("  Admin:   admin@test.com   / admin123");
    console.log("  Teacher: teacher@test.com / password123");
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
}

seedTestData();
