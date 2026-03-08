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
  const migrationPath = path.join(__dirname, "migrations", "003_performance_indexes.sql");
  const sql = await readFile(migrationPath, "utf8");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  
  try {
    console.log("🔄 Applying performance indexes migration...");
    await client.query(sql);
    console.log("✅ Performance indexes migration completed successfully!");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
