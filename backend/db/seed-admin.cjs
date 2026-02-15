const { Client } = require("pg");
require("dotenv").config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const hash = "$2b$10$m1DiVwmfT22xNZLxQfc4h.K.U9xwNvJ2Exv2Kt6Z0SkWKwRxUyLaG"; // password: 162005

  await client.query(
    `INSERT INTO users (name, email, role, auth_provider, password_hash)
     VALUES ('Admin', 'mrrifa@gmail.com', 'admin', 'local', $1)
     ON CONFLICT DO NOTHING`,
    [hash]
  );

  console.log("Admin user seeded.");
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
