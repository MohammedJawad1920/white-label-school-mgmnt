const db = require("../config/database");
require("dotenv").config();

async function enableFeatures() {
  try {
    console.log("🔧 Enabling features for test-school tenant...\n");

    const tenantId = "T001"; // test-school tenant

    // Enable Timetable
    await db.query(
      `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
       VALUES ('TF001', $1, 'timetable', true, NOW())
       ON CONFLICT (tenant_id, feature_key) 
       DO UPDATE SET enabled = true, enabled_at = NOW()`,
      [tenantId],
    );
    console.log("✅ Timetable Management enabled");

    // Enable Attendance (depends on Timetable)
    await db.query(
      `INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, enabled_at)
       VALUES ('TF002', $1, 'attendance', true, NOW())
       ON CONFLICT (tenant_id, feature_key) 
       DO UPDATE SET enabled = true, enabled_at = NOW()`,
      [tenantId],
    );
    console.log("✅ Attendance Tracking enabled\n");

    // Verify
    const result = await db.query(
      `SELECT f.key, f.name, tf.enabled, tf.enabled_at
       FROM features f
       LEFT JOIN tenant_features tf ON tf.feature_key = f.key AND tf.tenant_id = $1
       ORDER BY f.key`,
      [tenantId],
    );

    console.log("📊 Current feature status:");
    result.rows.forEach((row) => {
      const status = row.enabled ? "✅ Enabled" : "❌ Disabled";
      console.log(`   ${status} - ${row.name} (${row.key})`);
    });

    console.log("\n🎉 Features enabled successfully!");
    console.log("   You can now access timetable and attendance pages.");
    console.log("\n🔗 Next steps:");
    console.log("   1. Restart your server if it's running");
    console.log("   2. Clear browser cache (Ctrl+Shift+R)");
    console.log("   3. Login and navigate to Features page");
    console.log("   4. Test toggling features on/off\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error enabling features:");
    console.error("   ", error.message);
    console.error("\n💡 Make sure:");
    console.error("   - Database is running");
    console.error("   - Schema is up to date (features table exists)");
    console.error("   - Tenant T001 exists in database\n");
    process.exit(1);
  }
}

enableFeatures();
