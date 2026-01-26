const bcrypt = require("bcrypt");
const db = require("../config/database");
require("dotenv").config();

async function createTestUser() {
  try {
    const password = "password123";
    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, roles)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, email) DO NOTHING`,
      [
        "U001",
        "T001",
        "Test Teacher",
        "teacher@test.com",
        passwordHash,
        JSON.stringify(["Teacher"]),
      ],
    );

    console.log("✅ Test user created:");
    console.log("   Email: teacher@test.com");
    console.log("   Password: password123");
    console.log("   Tenant: T001 (test-school)");

    process.exit(0);
  } catch (error) {
    console.error("Error creating test user:", error.message);
    process.exit(1);
  }
}

createTestUser();
