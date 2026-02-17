const db = require("../config/database");
require("dotenv").config();

async function migrateToV31() {
  console.log("🚀 Starting v3.1 Soft Delete Migration...\n");

  try {
    // Step 1: Add deleted_at columns
    console.log("1️⃣  Adding deleted_at columns...");

    await db.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log("   ✅ users.deleted_at added");

    await db.query(`
      ALTER TABLE batches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log("   ✅ batches.deleted_at added");

    await db.query(`
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log("   ✅ subjects.deleted_at added");

    await db.query(`
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log("   ✅ classes.deleted_at added");

    await db.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log("   ✅ students.deleted_at added");

    await db.query(`
      ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
    `);
    console.log("   ✅ time_slots.deleted_at added\n");

    // Step 2: Add indexes for performance
    console.log("2️⃣  Adding performance indexes...");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_deleted 
      ON users(tenant_id, deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log("   ✅ idx_users_deleted created");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_batches_deleted 
      ON batches(tenant_id, deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log("   ✅ idx_batches_deleted created");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_subjects_deleted 
      ON subjects(tenant_id, deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log("   ✅ idx_subjects_deleted created");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_classes_deleted 
      ON classes(tenant_id, deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log("   ✅ idx_classes_deleted created");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_students_deleted 
      ON students(tenant_id, deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log("   ✅ idx_students_deleted created");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_time_slots_deleted 
      ON time_slots(tenant_id, deleted_at) WHERE deleted_at IS NULL;
    `);
    console.log("   ✅ idx_time_slots_deleted created\n");

    // Step 3: Update email uniqueness constraint
    console.log("3️⃣  Updating email uniqueness constraint...");

    await db.query(`
      DROP INDEX IF EXISTS idx_users_email_unique;
    `);
    console.log("   ✅ Old constraint dropped");

    await db.query(`
      CREATE UNIQUE INDEX idx_users_email_active 
      ON users(tenant_id, email) WHERE deleted_at IS NULL;
    `);
    console.log("   ✅ New partial unique index created\n");

    // Step 4: Verify migration
    console.log("4️⃣  Verifying migration...");

    const result = await db.query(`
      SELECT column_name, table_name 
      FROM information_schema.columns 
      WHERE column_name = 'deleted_at' 
      AND table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(
      `   ✅ Found ${result.rows.length} tables with deleted_at column:`,
    );
    result.rows.forEach((row) => {
      console.log(`      - ${row.table_name}`);
    });

    console.log("\n🎉 v3.1 Migration Complete!");
    console.log("\n📋 Next Steps:");
    console.log("   1. Replace controllers with v3.1 versions");
    console.log("   2. Restart your server");
    console.log("   3. Run: node server/scripts/test-soft-delete.js\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration Failed:");
    console.error("   Error:", error.message);
    console.error("\n   Stack:", error.stack);
    process.exit(1);
  }
}

migrateToV31();
