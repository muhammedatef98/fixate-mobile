-- Make service_id nullable in orders table
ALTER TABLE orders ALTER COLUMN service_id DROP NOT NULL;
