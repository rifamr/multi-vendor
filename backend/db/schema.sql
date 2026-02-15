-- Postgres schema (matches the provided ERD)
-- Safe to run multiple times (IF NOT EXISTS used where possible).

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             VARCHAR,
  email            VARCHAR NOT NULL UNIQUE,
  role             VARCHAR,
  auth_provider    VARCHAR,
  created_at       TIMESTAMP DEFAULT NOW()
);

-- Auth additions (local email/password)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Phone number for contact
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR;

-- Role should be present for the role-based auth rules.
UPDATE users SET role = 'customer' WHERE role IS NULL;
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

-- Rule: same email can exist in different roles, but not duplicated within the same role.
-- Drop the old unique(email) constraint if it exists, then create a unique index on (lower(email), role).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email_role ON users (lower(email), role);

CREATE TABLE IF NOT EXISTS service_categories (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name             VARCHAR,
  description      VARCHAR
);

CREATE TABLE IF NOT EXISTS vendors (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  business_name    VARCHAR,
  service_area     VARCHAR,
  experience_years INTEGER,
  is_verified      BOOLEAN,
  created_at       TIMESTAMP DEFAULT NOW(),
  CONSTRAINT vendors_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT vendors_user_unique UNIQUE (user_id)
);

-- Add additional vendor profile columns
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS service_category_id INTEGER;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS license_document_url VARCHAR;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone_number VARCHAR;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS description TEXT;

CREATE TABLE IF NOT EXISTS services (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id        INTEGER NOT NULL,
  category_id      INTEGER NOT NULL,
  title            VARCHAR,
  description      TEXT,
  price            NUMERIC,
  duration_minutes INTEGER,
  is_active        BOOLEAN,
  created_at       TIMESTAMP DEFAULT NOW(),
  CONSTRAINT services_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT,
  CONSTRAINT services_category_fk FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  vendor_id        INTEGER NOT NULL,
  slot_date        DATE,
  start_time       TIME,
  end_time         TIME,
  is_available     BOOLEAN,
  CONSTRAINT availability_slots_vendor_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

-- Add service_id column to link slots to specific services
ALTER TABLE availability_slots ADD COLUMN IF NOT EXISTS service_id INTEGER;

DO $$ BEGIN
  ALTER TABLE availability_slots ADD CONSTRAINT availability_slots_service_fk 
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS bookings (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id      INTEGER NOT NULL,
  service_id       INTEGER NOT NULL,
  slot_id          INTEGER NOT NULL,
  status           VARCHAR,
  booking_date     TIMESTAMP,
  CONSTRAINT bookings_customer_fk FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT bookings_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE RESTRICT,
  CONSTRAINT bookings_slot_fk FOREIGN KEY (slot_id) REFERENCES availability_slots(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payments (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id       INTEGER NOT NULL,
  amount           NUMERIC,
  payment_status   VARCHAR,
  payment_date     TIMESTAMP,
  CONSTRAINT payments_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id       INTEGER NOT NULL,
  customer_id      INTEGER NOT NULL,
  service_id       INTEGER NOT NULL,
  rating           INTEGER NOT NULL,
  comment          TEXT,
  moderation_status VARCHAR DEFAULT 'pending',
  created_at       TIMESTAMP DEFAULT NOW(),
  CONSTRAINT reviews_booking_fk FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT reviews_customer_fk FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT reviews_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
  CONSTRAINT reviews_rating_range CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT reviews_booking_unique UNIQUE (booking_id)
);

-- Add columns to existing reviews table if they don't exist
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS service_id INTEGER;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_status VARCHAR DEFAULT 'pending';

-- Add foreign key constraints if they don't exist
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_customer_fk FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_service_fk FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add unique constraint on booking_id
DO $$ BEGIN
  ALTER TABLE reviews ADD CONSTRAINT reviews_booking_unique UNIQUE (booking_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN others THEN 
    IF SQLERRM LIKE '%already exists%' THEN
      NULL;
    ELSE
      RAISE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  message          TEXT,
  is_read          BOOLEAN,
  created_at       TIMESTAMP,
  CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_services_vendor_id ON services(vendor_id);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);
CREATE INDEX IF NOT EXISTS idx_slots_vendor_id ON availability_slots(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

COMMIT;
