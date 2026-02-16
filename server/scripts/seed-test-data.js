const bcrypt = require("bcrypt");
const db = require("../config/database");
require("dotenv").config();

async function seedTestData() {
  try {
    console.log("🌱 Seeding test data...\n");

    // 1. Tenant (already exists from foundation)
    await db.query(`
      INSERT INTO tenants (id, name, slug) 
      VALUES ('T001', 'Test School', 'test-school')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("✅ Tenant created");

    // 2. Admin user
    const adminHash = await bcrypt.hash("admin123", 10);
    await db.query(
      `
      INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      ON CONFLICT (tenant_id, email) DO NOTHING
    `,
      [
        "ADMIN001",
        "T001",
        "Admin User",
        "admin@test.com",
        adminHash,
        '["Admin"]',
      ],
    );
    console.log(
      "✅ Admin user created (email: admin@test.com, password: admin123)",
    );

    // 3. Batch
    await db.query(`
      INSERT INTO batches (id, tenant_id, name, start_year, end_year)
      VALUES ('B001', 'T001', '2025-2026', 2025, 2026)
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("✅ Batch created");

    // 4. Class
    await db.query(`
      INSERT INTO classes (id, tenant_id, name, batch_id)
      VALUES ('C001', 'T001', 'Grade 10A', 'B001')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("✅ Class created");

    // 5. Subject
    await db.query(`
      INSERT INTO subjects (id, tenant_id, name, code)
      VALUES ('SUB001', 'T001', 'Mathematics', 'MATH101')
      ON CONFLICT (id) DO NOTHING
    `);
    console.log("✅ Subject created");

    // 6. Ensure U001 has Teacher role
    await db.query(`
      UPDATE users SET roles = '["Teacher"]'::jsonb WHERE id = 'U001'
    `);
    console.log("✅ Teacher role updated for U001\n");

    console.log("🎉 Test data seeded successfully!");
    console.log("\nYou can now test with:");
    console.log("  Admin: admin@test.com / admin123");
    console.log("  Teacher: teacher@test.com / password123");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    process.exit(1);
  }
}

seedTestData();
