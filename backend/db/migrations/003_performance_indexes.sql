-- Performance optimization indexes
-- Run this migration to improve query performance under load

-- Composite index for service queries with filtering
CREATE INDEX IF NOT EXISTS idx_services_active_category 
  ON services(is_active, category_id) 
  WHERE is_active = true;

-- Index for vendor city searches (location filtering)
CREATE INDEX IF NOT EXISTS idx_vendors_city 
  ON vendors(city);

-- Index for service price filtering (helps with range queries)
CREATE INDEX IF NOT EXISTS idx_services_price 
  ON services(price) 
  WHERE is_active = true;

-- Composite index for bookings join optimizations
CREATE INDEX IF NOT EXISTS idx_bookings_service_status 
  ON bookings(service_id, status);

-- Index for reviews with rating (helps with aggregations)
CREATE INDEX IF NOT EXISTS idx_reviews_booking_rating 
  ON reviews(booking_id, rating);

-- Index for service title searches (helps with ILIKE queries)
CREATE INDEX IF NOT EXISTS idx_services_title_gin 
  ON services USING gin(to_tsvector('english', title));

-- Index for vendor business name searches
CREATE INDEX IF NOT EXISTS idx_vendors_business_name_gin 
  ON vendors USING gin(to_tsvector('english', business_name));

-- Analyze tables to update statistics after index creation
ANALYZE services;
ANALYZE vendors;
ANALYZE bookings;
ANALYZE reviews;
ANALYZE service_categories;
