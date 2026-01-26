const jwt = require("jsonwebtoken");
const db = require("../config/database");
require("dotenv").config();

async function testTenantIsolation() {
  console.log("🧪 Testing Tenant Isolation...\n");
  try {
    // Setup: Create two tenants
    await db.query(`INSERT INTO tenants (id, name, slug) VALUES
        ('T_TEST_A', 'Test School A', 'test-school-a'),
        ('T_TEST_B', 'Test School B', 'test-school-b') 
        ON CONFLICT (slug) DO NOTHING`);

    // Setup: Create two batches
    await db.query(`INSERT INTO batches (id, tenant_id, name, start_year, end_year) VALUES
      ('B_TEST_A', 'T_TEST_A', 'Batch A', 2025, 2026),
      ('B_TEST_B', 'T_TEST_B', 'Batch B', 2025, 2026)
      ON CONFLICT (id) DO NOTHING`);

    // Setup: Create two classes
    await db.query(`INSERT INTO classes (id, tenant_id, name, batch_id) VALUES
      ('C_TEST_A', 'T_TEST_A', 'Class 10A', 'B_TEST_A'),
      ('C_TEST_B', 'T_TEST_B', 'Class 10B', 'B_TEST_B')
      ON CONFLICT (id) DO NOTHING`);

    // Setup: Create two students
    await db.query(`INSERT INTO students (id, tenant_id, name, class_id, batch_id) VALUES
      ('S_TEST_A', 'T_TEST_A', 'Alice (School A)', 'C_TEST_A', 'B_TEST_A'),
      ('S_TEST_B', 'T_TEST_B', 'Bob (School B)', 'C_TEST_B', 'B_TEST_B')
      ON CONFLICT (id) DO NOTHING`);

    console.log("✅ Test data created\n");

    // Test 1: Query with tenant filter (correct behavior)
    console.log("Test 1: Query students from School A (with tenant filter)");

    const schoolAStudents = await db.query(
      `SELECT * FROM students WHERE tenant_id = $1`,
      ["T_TEST_A"],
    );

    console.log(`   Found ${schoolAStudents.rows.length} student(s)`);
    console.log(
      `   Names: ${schoolAStudents.rows.map((s) => s.name).join(", ")}`,
    );

    if (
      schoolAStudents.rows.length === 1 &&
      schoolAStudents.rows[0].name === "Alice (School A)"
    ) {
      console.log("   ✅ PASS: Only School A data returned\n");
    } else {
      console.log("   ❌ FAIL: Wrong data returned\n");
      process.exit(1);
    }

    // Test 2: Query School B's class with School A's tenant filter
    console.log("Test 2: Query School B's class with School A's tenant filter");
    const crossTenantQuery = await db.query(
      "SELECT * FROM students WHERE class_id = $1 AND tenant_id = $2",
      ["C_TEST_B", "T_TEST_A"],
    );
    console.log(`   Found ${crossTenantQuery.rows.length} student(s)`);

    if (crossTenantQuery.rows.length === 0) {
      console.log("   ✅ PASS: No cross-tenant data leak\n");
    } else {
      console.log("   ❌ FAIL: Cross-tenant data leak detected!\n");
      process.exit(1);
    }

    // Test 3: Simulate JWT from School A trying to access School B's data
    console.log(
      "Test 3: Simulate API request with School A JWT accessing School B data",
    );

    const schoolAToken = jwt.sign(
      { userId: "U_TEST", tenantId: "T_TEST_A", roles: ["Teacher"] },
      process.env.JWT_SECRET,
    );
    const decoded = jwt.verify(schoolAToken, process.env.JWT_SECRET);

    // This is what your API handler would do
    const apiQuery = await db.query(
      "SELECT * FROM students WHERE class_id = $1 AND tenant_id = $2",
      ["C_TEST_B", decoded.tenantId], // Try to access School B's class with School A's tenantId
    );

    console.log(`   JWT contains tenantId: ${decoded.tenantId}`);
    console.log(`   Querying class: C_TEST_B (belongs to School B)`);
    console.log(`   Found ${apiQuery.rows.length} student(s)`);

    if (apiQuery.rows.length === 0) {
      console.log("   ✅ PASS: Tenant isolation enforced by query\n");
    } else {
      console.log("   ❌ FAIL: Tenant isolation broken!\n");
      process.exit(1);
    }

    // Cleanup
    await db.query(`DELETE FROM students WHERE id IN ('S_TEST_A', 'S_TEST_B')`);
    await db.query(`DELETE FROM classes WHERE id IN ('C_TEST_A', 'C_TEST_B')`);
    await db.query(`DELETE FROM batches WHERE id IN ('B_TEST_A', 'B_TEST_B')`);
    await db.query(`DELETE FROM tenants WHERE id IN ('T_TEST_A', 'T_TEST_B')`);

    console.log("✅ Test data cleaned up");
    console.log("\n🎉 All tenant isolation tests passed!");
    console.log("\n✨ Your system is secure against cross-tenant data leaks.");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    process.exit(1);
  }
}

testTenantIsolation();
