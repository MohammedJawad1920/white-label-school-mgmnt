require("dotenv").config();
const { Client } = require("pg");
const client = new Client({ connectionString: process.env.DATABASE_URL });
client
  .connect()
  .then(() =>
    client.query(
      `SELECT table_name, column_name, column_default, data_type
     FROM information_schema.columns
     WHERE table_schema='public'
       AND data_type = 'character varying'
       AND column_default IS NOT NULL
     ORDER BY table_name, column_name`,
    ),
  )
  .then((r) => {
    r.rows.forEach((x) =>
      console.log(x.table_name, x.column_name, "|", x.column_default),
    );
    return client.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
