const { Pool } = require("pg");
require("dotenv").config();

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  min: 2,
  max: 10,
});


// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Failed to connect to PostgreSQL:", err.message);
    process.exit(1); // Crash the app if database unreachable
  }
  console.log("✅ PostgreSQL connected");
  release(); // Return connection to pool
});

// Export query function
module.exports = {
  query: (text, params) => pool.query(text, params),
  pool, // Export pool for advanced use cases
};
