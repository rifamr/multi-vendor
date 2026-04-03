import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

async function main() {
  const databaseUrl = getEnvOrThrow("DATABASE_URL");

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.join(__dirname, "schema.sql");
  const sql = await readFile(schemaPath, "utf8");

  async function applySchema(connectionString: string) {
    const client = new Client({ connectionString });
    await client.connect();
    try {
      await client.query(sql);
    } finally {
      await client.end();
    }
  }

  try {
    await applySchema(databaseUrl);
    // eslint-disable-next-line no-console
    console.log("✅ Database schema applied.");
    return;
  } catch (err: any) {
    // If the database doesn't exist yet, create it automatically.
    // Postgres error code 3D000 = invalid_catalog_name
    if (err?.code !== "3D000") throw err;

    const url = new URL(databaseUrl);
    const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
    if (!dbName) throw new Error("DATABASE_URL must include a database name (e.g. .../gig_connect)");

    const maintenanceUrl = new URL(databaseUrl);
    maintenanceUrl.pathname = "/postgres";

    const maintenanceClient = new Client({ connectionString: maintenanceUrl.toString() });
    await maintenanceClient.connect();
    try {
      const exists = await maintenanceClient.query<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
        [dbName]
      );

      if (!exists.rows[0]?.exists) {
        const safeIdentifier = `"${dbName.replace(/"/g, '""')}"`;
        await maintenanceClient.query(`CREATE DATABASE ${safeIdentifier}`);
        // eslint-disable-next-line no-console
        console.log(`✅ Created database ${dbName}.`);
      }
    } finally {
      await maintenanceClient.end();
    }

    await applySchema(databaseUrl);
    // eslint-disable-next-line no-console
    console.log("✅ Database schema applied.");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ DB migrate failed:", err);
  process.exit(1);
});
