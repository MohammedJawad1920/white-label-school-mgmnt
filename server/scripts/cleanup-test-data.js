const db = require("../config/database");
require("dotenv").config();

/**
 * Clean up test data created by authorization tests
 */

async function cleanupTestData() {
  try {
    console.log("🧹 Cleaning up authorization test data...\n");

    // Delete test users created by validation tests
    const testUserIds = ["U_TEST_EMPTY", "U_TEST_INVALID"];

    for (const userId of testUserIds) {
      const result = await db.query("DELETE FROM users WHERE id = $1", [
        userId,
      ]);

      if (result.rowCount > 0) {
        console.log(`✅ Deleted test user: ${userId}`);
      } else {
        console.log(`ℹ️  Test user not found: ${userId}`);
      }
    }

    console.log("\n✅ Cleanup complete!\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Cleanup error:", error);
    process.exit(1);
  }
}

cleanupTestData();
