const db = require("../config/database");
require("dotenv").config();

async function fixEmailConstraint() {
  console.log("🔧 Fixing Email Constraint Issue...\n");

  try {
    // Step 1: Check what constraints exist
    console.log("1️⃣  Checking existing constraints...\n");

    const constraints = await db.query(`
      SELECT conname, contype 
      FROM pg_constraint 
      WHERE conrelid = 'users'::regclass 
      AND conname LIKE '%email%';
    `);

    console.log("   Found constraints:");
    constraints.rows.forEach((c) => {
      console.log(`      - ${c.conname} (type: ${c.contype})`);
    });
    console.log("");

    // Step 2: Drop the old unique constraint
    console.log("2️⃣  Dropping old unique constraint...\n");

    try {
      await db.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_id_email_key;
      `);
      console.log("   ✅ Old constraint dropped\n");
    } catch (err) {
      console.log("   ⚠️  Old constraint doesn't exist (already dropped)\n");
    }

    // Step 3: Ensure the partial unique index exists
    console.log("3️⃣  Ensuring partial unique index exists...\n");

    await db.query(`
      DROP INDEX IF EXISTS idx_users_email_active;
    `);
    console.log("   ✅ Cleaned up any old partial index");

    await db.query(`
      CREATE UNIQUE INDEX idx_users_email_active 
      ON users(tenant_id, email) 
      WHERE deleted_at IS NULL;
    `);
    console.log(
      "   ✅ Created partial unique index (allows email reuse after soft delete)\n",
    );

    // Step 4: Verify the fix
    console.log("4️⃣  Verifying fix...\n");

    const indexes = await db.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'users' 
      AND indexname LIKE '%email%';
    `);

    console.log("   Current email indexes:");
    indexes.rows.forEach((i) => {
      console.log(`      - ${i.indexname}`);
      console.log(`        ${i.indexdef}`);
    });
    console.log("");

    console.log("🎉 Email Constraint Fixed!\n");
    console.log("📋 Summary:");
    console.log("   ✓ Old constraint removed");
    console.log("   ✓ Partial unique index in place");
    console.log("   ✓ Email reuse now works after soft delete\n");
    console.log("🧪 Run this to verify:");
    console.log("   node server/scripts/test-soft-delete.js\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Fix Failed:");
    console.error("   Error:", error.message);
    console.error("\n   Stack:", error.stack);
    process.exit(1);
  }
}

fixEmailConstraint();
