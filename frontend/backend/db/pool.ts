import { Pool } from "pg";

let pool: Pool | null = null;

export function getPoolOptional(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      // Critical performance settings for high concurrency
      max: 20, // Maximum pool size (was unlimited, causing resource exhaustion)
      min: 2, // Minimum idle connections
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 5000, // Fail fast if no connection available in 5s
      maxUses: 7500, // Recycle connections after 7500 uses
      allowExitOnIdle: false, // Keep pool alive
      // Query timeout to prevent hanging queries
      statement_timeout: 10000, // 10 second query timeout
    });

    // Error handling for pool
    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });

    pool.on('connect', () => {
      if (process.env.NODE_ENV === "development") {
        console.log('Database connection established');
      }
    });
  }

  return pool;
}

export function getPool(): Pool {
  const p = getPoolOptional();
  if (!p) throw new Error("DATABASE_URL is not set");
  return p;
}

// Graceful shutdown
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
