require("dotenv").config();
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client
  .connect()
  .then(() =>
    client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`,
    ),
  )
  .then((r) => {
    console.log("Tables (" + r.rows.length + "):");
    r.rows.forEach((x) => console.log(" ", x.tablename));
    return client.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
