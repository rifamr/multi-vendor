-- Add additional fields to vendors table for enhanced vendor profiles
BEGIN;

-- Add service category reference
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS service_category_id INTEGER;
ALTER TABLE vendors ADD CONSTRAINT vendors_service_category_fk 
  FOREIGN KEY (service_category_id) REFERENCES service_categories(id) ON DELETE SET NULL;

-- Add license/certification document URL
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS license_document_url VARCHAR;

-- Add phone number
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);

-- Add description/bio
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for service category lookups
CREATE INDEX IF NOT EXISTS idx_vendors_service_category_id ON vendors(service_category_id);

COMMIT;
