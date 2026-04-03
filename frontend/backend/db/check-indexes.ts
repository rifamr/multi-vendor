import "dotenv/config";
import { Client } from "pg";

async function checkIndexes() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not set");
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND (
          indexname LIKE 'idx_services_%' OR
          indexname LIKE 'idx_vendors_%' OR
          indexname LIKE 'idx_bookings_%' OR
          indexname LIKE 'idx_reviews_%'
        )
      ORDER BY tablename, indexname;
    `);

    console.log("\n📊 Database Indexes Status:\n");
    console.log("Total performance indexes:", result.rows.length);
    console.log("\n");

    const newIndexes = [
      'idx_services_active_category',
      'idx_vendors_city', 
      'idx_services_price',
      'idx_bookings_service_status',
      'idx_reviews_booking_rating',
      'idx_services_title_gin',
      'idx_vendors_business_name_gin'
    ];

    newIndexes.forEach(indexName => {
      const found = result.rows.find(row => row.indexname === indexName);
      if (found) {
        console.log(`✅ ${indexName}`);
      } else {
        console.log(`❌ ${indexName} (not found)`);
      }
    });

    console.log("\n📋 All indexes on performance-critical tables:");
    result.rows.forEach(row => {
      console.log(`  • ${row.tablename}.${row.indexname}`);
    });

  } finally {
    await client.end();
  }
}

checkIndexes().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
