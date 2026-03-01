#!/usr/bin/env bash
# ─────────────────────────────────────────────────────
# cleanup-test-data.sh — Remove all test data from the DB
# Run this after tests if you want a clean slate
# ─────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Cleaning up test data..."

cd "$SCRIPT_DIR/.."

node -e "
const { Pool } = require('pg');
require('dotenv').config();

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // Delete in reverse dependency order
    await pool.query(\"DELETE FROM attendance WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM timeslots WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM students WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM classes WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM subjects WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM batches WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM school_periods WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM users WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM tenant_features WHERE tenant_id IN (SELECT id FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%')\");
    await pool.query(\"DELETE FROM tenants WHERE slug LIKE 'testschool%' OR slug LIKE 'deact%' OR slug LIKE 'fresh%'\");
    console.log('Test data cleaned up successfully.');
  } catch (err) {
    console.error('Cleanup error:', err.message);
  } finally {
    await pool.end();
  }
})();
"

# Remove state file
rm -f /tmp/wl-test-state*.json
echo "State files removed."
echo "Done."
