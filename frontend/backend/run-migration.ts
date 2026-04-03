import "dotenv/config";
import { getPool } from "./db/pool";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration() {
  const pool = getPool();
  
  try {
    const migrationPath = path.join(__dirname, "db/migrations/002_add_vendor_fields.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    
    console.log("Running vendor fields migration...");
    await pool.query(sql);
    console.log("✅ Migration completed successfully!");
    
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
