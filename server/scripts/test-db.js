const db = require("../config/database");

async function testConnection() {
  try {
    const result = await db.query("SELECT * FROM tenants;");
    console.log("Query successful:", result.rows);
    process.exit(0);
  } catch (err) {
    console.error("Query failed:", err.message);
    process.exit(1);
  }
}

testConnection();
