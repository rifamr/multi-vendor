import "dotenv/config";
import { Pool } from "pg";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  console.log("=== INDEX USAGE ANALYSIS ===\n");

  // 1. Main services query (the one autocannon hits)
  console.log("--- Query: Services list (main load test query) ---");
  const r1 = await pool.query(`
    EXPLAIN ANALYZE
    SELECT
      s.id::text AS id, s.title, s.description, s.price::float AS price,
      s.duration_minutes, s.is_active AS active,
      s.category_id::text AS category_id, sc.name AS category_name,
      v.id::text AS vendor_id, v.business_name AS vendor_name,
      v.service_area AS vendor_area, v.shop_image_url AS vendor_shop_image_url,
      COALESCE(rs.rating_avg, 0)::float AS rating_avg,
      COALESCE(rs.reviews_count, 0)::int AS reviews_count
    FROM services s
    JOIN service_categories sc ON sc.id = s.category_id
    JOIN vendors v ON v.id = s.vendor_id
    LEFT JOIN (
      SELECT b.service_id, AVG(r.rating)::float AS rating_avg, COUNT(r.id)::int AS reviews_count
      FROM bookings b INNER JOIN reviews r ON r.booking_id = b.id
      GROUP BY b.service_id
    ) rs ON rs.service_id = s.id
    WHERE COALESCE(s.is_active, true) = true
    ORDER BY COALESCE(rs.rating_avg, 0) DESC, s.id ASC
    LIMIT 50 OFFSET 0
  `);
  r1.rows.forEach((r) => console.log(r["QUERY PLAN"]));

  console.log("\n--- Query: Services filtered by category (uses idx_services_active_category) ---");
  const r2 = await pool.query(`
    EXPLAIN ANALYZE
    SELECT s.id, s.title, s.price
    FROM services s
    WHERE s.is_active = true AND s.category_id = 1
    ORDER BY s.id ASC LIMIT 50
  `);
  r2.rows.forEach((r) => console.log(r["QUERY PLAN"]));

  console.log("\n--- Query: Service by ID (uses PK index) ---");
  const r3 = await pool.query(`
    EXPLAIN ANALYZE
    SELECT s.id, s.title FROM services s WHERE s.id = 1
  `);
  r3.rows.forEach((r) => console.log(r["QUERY PLAN"]));

  console.log("\n--- Query: Reviews aggregation (uses idx_reviews_booking_rating) ---");
  const r4 = await pool.query(`
    EXPLAIN ANALYZE
    SELECT b.service_id, AVG(r.rating), COUNT(r.id)
    FROM bookings b
    INNER JOIN reviews r ON r.booking_id = b.id
    GROUP BY b.service_id
  `);
  r4.rows.forEach((r) => console.log(r["QUERY PLAN"]));

  console.log("\n--- Query: Price range filter (uses idx_services_price) ---");
  const r5 = await pool.query(`
    EXPLAIN ANALYZE
    SELECT s.id, s.title, s.price
    FROM services s
    WHERE s.is_active = true AND s.price >= 1000 AND s.price <= 5000
    ORDER BY s.price ASC LIMIT 50
  `);
  r5.rows.forEach((r) => console.log(r["QUERY PLAN"]));

  console.log("\n--- Query: Full-text search (uses idx_services_title_gin) ---");
  const r6 = await pool.query(`
    EXPLAIN ANALYZE
    SELECT s.id, s.title
    FROM services s
    WHERE to_tsvector('english', s.title) @@ to_tsquery('english', 'cleaning')
  `);
  r6.rows.forEach((r) => console.log(r["QUERY PLAN"]));

  console.log("\n\n=== INDEX SCAN STATISTICS ===");
  const stats = await pool.query(`
    SELECT indexrelname AS index_name, 
           idx_scan AS scans,
           idx_tup_read AS tuples_read,
           idx_tup_fetch AS tuples_fetched,
           pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC
  `);
  console.table(stats.rows);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
