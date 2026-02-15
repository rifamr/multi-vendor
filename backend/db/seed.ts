import "dotenv/config";

import { Client } from "pg";

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

async function main() {
  const databaseUrl = getEnvOrThrow("DATABASE_URL");
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Keep this seed minimal and idempotent-ish for dev.
    // Categories
    await client.query(
      `INSERT INTO service_categories (id, name, description) OVERRIDING SYSTEM VALUE
       VALUES
        (1,'Beauty & Spa',NULL),
        (2,'Home Services',NULL),
        (3,'Auto Care',NULL),
        (4,'Photography',NULL),
        (5,'Fitness',NULL),
        (6,'Tutoring',NULL),
        (7,'Repairs',NULL)
       ON CONFLICT (id) DO NOTHING;`
    );

    // Users (vendors + one sample customer + admin)
    await client.query(
      `INSERT INTO users (id, name, email, role, auth_provider, password_hash) OVERRIDING SYSTEM VALUE
       VALUES
        (1,'StyleHub Studio','stylehub@example.com','vendor','seed',NULL),
        (2,'CleanPro Services','cleanpro@example.com','vendor','seed',NULL),
        (3,'AutoShine Garage','autoshine@example.com','vendor','seed',NULL),
        (4,'LensArt Studio','lensart@example.com','vendor','seed',NULL),
        (5,'FitLife Gym','fitlife@example.com','vendor','seed',NULL),
        (6,'BrightMinds Academy','brightminds@example.com','vendor','seed',NULL),
        (100,'Demo Customer','customer@example.com','customer','seed',NULL),
        (101,'Admin','mrrifa@gmail.com','admin','local','$2b$10$m1DiVwmfT22xNZLxQfc4h.K.U9xwNvJ2Exv2Kt6Z0SkWKwRxUyLaG')
       ON CONFLICT (id) DO NOTHING;`
    );

    // Vendors
    await client.query(
      `INSERT INTO vendors (id, user_id, business_name, service_area, experience_years, is_verified) OVERRIDING SYSTEM VALUE
       VALUES
        (1,1,'StyleHub Studio','New York, NY',5,true),
        (2,2,'CleanPro Services','New York, NY',3,true),
        (3,3,'AutoShine Garage','Brooklyn, NY',7,true),
        (4,4,'LensArt Studio','Queens, NY',4,true),
        (5,5,'FitLife Gym','New York, NY',6,true),
        (6,6,'BrightMinds Academy','Jersey City, NJ',8,true)
       ON CONFLICT (id) DO NOTHING;`
    );

    // Services
    await client.query(
      `INSERT INTO services (id, vendor_id, category_id, title, description, price, duration_minutes, is_active) OVERRIDING SYSTEM VALUE
       VALUES
        (1,1,1,'Premium Haircut & Styling','Professional haircut and styling tailored to your look.',45,45,true),
        (2,2,2,'Deep House Cleaning','Whole-home deep cleaning by vetted professionals.',120,180,true),
        (3,3,3,'Full Car Detailing','Interior and exterior detailing for a showroom finish.',89,120,true),
        (4,4,4,'Portrait Photography','Studio-quality portraits with retouching included.',150,60,true),
        (5,5,5,'Personal Training Session','1:1 training session personalized to your goals.',60,60,true),
        (6,6,6,'Math Tutoring','Private math tutoring from middle school to college.',35,60,true)
       ON CONFLICT (id) DO NOTHING;`
    );

    // Minimal availability slots for vendor 4 (Photography)
    await client.query(
      `INSERT INTO availability_slots (id, vendor_id, slot_date, start_time, end_time, is_available) OVERRIDING SYSTEM VALUE
       VALUES
        (1, 4, CURRENT_DATE, '10:00', '11:00', true),
        (2, 4, CURRENT_DATE, '12:00', '13:00', true)
       ON CONFLICT (id) DO NOTHING;`
    );

    // IMPORTANT:
    // We insert explicit IDs above (OVERRIDING SYSTEM VALUE). Postgres identity sequences
    // do NOT automatically advance to match MAX(id), which can cause "duplicate key" on
    // later inserts (e.g. new user registration).
    await client.query(
      `SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT MAX(id) FROM users), 0), true);`
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('service_categories','id'), COALESCE((SELECT MAX(id) FROM service_categories), 0), true);`
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('vendors','id'), COALESCE((SELECT MAX(id) FROM vendors), 0), true);`
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('services','id'), COALESCE((SELECT MAX(id) FROM services), 0), true);`
    );
    await client.query(
      `SELECT setval(pg_get_serial_sequence('availability_slots','id'), COALESCE((SELECT MAX(id) FROM availability_slots), 0), true);`
    );

    // eslint-disable-next-line no-console
    console.log("✅ Seed complete.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ DB seed failed:", err);
  process.exit(1);
});
