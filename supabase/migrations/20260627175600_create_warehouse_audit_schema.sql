/*
# Warehouse Audit Tool Schema

## Overview
Creates the database schema for a warehouse inventory audit tool that tracks
11,000+ products across multiple warehouse locations. Auditors can count
stock and record discrepancies between system and physical counts.

## New Tables

### locations
- `id` (uuid, primary key)
- `code` (text, unique) — short location code e.g. "A-01-03"
- `name` (text) — human-readable name e.g. "Aisle A, Rack 1, Shelf 3"
- `zone` (text) — broader zone grouping e.g. "Aisle A"
- `created_at` (timestamptz)

### products
- `id` (uuid, primary key)
- `sku` (text, unique) — stock keeping unit
- `name` (text) — product name
- `category` (text) — product category
- `unit` (text) — unit of measure e.g. "pcs", "box"
- `system_quantity` (integer) — expected quantity per system records
- `location_id` (uuid, FK to locations) — where the product is stored
- `barcode` (text, nullable) — optional barcode
- `created_at` (timestamptz)

### audits
- `id` (uuid, primary key)
- `name` (text) — audit session name e.g. "June 2026 Full Audit"
- `status` (text) — 'in_progress' | 'completed'
- `created_at` (timestamptz)
- `completed_at` (timestamptz, nullable)

### audit_items
- `id` (uuid, primary key)
- `audit_id` (uuid, FK to audits) — which audit session this belongs to
- `product_id` (uuid, FK to products) — product being counted
- `counted_quantity` (integer, nullable) — physical count; null = not yet counted
- `status` (text) — 'pending' | 'counted' | 'flagged'
- `note` (text, nullable) — auditor note
- `counted_at` (timestamptz, nullable)
- UNIQUE constraint on (audit_id, product_id)

## Security
- Single-tenant app (no sign-in). RLS enabled on all tables.
- Policies allow anon + authenticated full CRUD since data is intentionally shared.
- `USING (true)` is documented as intentional for this public/shared tool.

## Indexes
- products.sku, products.location_id, products.category
- locations.code, locations.zone
- audit_items.audit_id, audit_items.status, audit_items.product_id
*/

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  zone text NOT NULL DEFAULT 'Unassigned',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_locations" ON locations;
CREATE POLICY "anon_select_locations" ON locations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_locations" ON locations;
CREATE POLICY "anon_insert_locations" ON locations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_locations" ON locations;
CREATE POLICY "anon_update_locations" ON locations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_locations" ON locations;
CREATE POLICY "anon_delete_locations" ON locations FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  unit text NOT NULL DEFAULT 'pcs',
  system_quantity integer NOT NULL DEFAULT 0,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  barcode text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audits" ON audits;
CREATE POLICY "anon_select_audits" ON audits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audits" ON audits;
CREATE POLICY "anon_insert_audits" ON audits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audits" ON audits;
CREATE POLICY "anon_update_audits" ON audits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audits" ON audits;
CREATE POLICY "anon_delete_audits" ON audits FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS audit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  counted_quantity integer,
  status text NOT NULL DEFAULT 'pending',
  note text,
  counted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (audit_id, product_id)
);

ALTER TABLE audit_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_items" ON audit_items;
CREATE POLICY "anon_select_audit_items" ON audit_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_items" ON audit_items;
CREATE POLICY "anon_insert_audit_items" ON audit_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audit_items" ON audit_items;
CREATE POLICY "anon_update_audit_items" ON audit_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit_items" ON audit_items;
CREATE POLICY "anon_delete_audit_items" ON audit_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_products_location_id ON products (location_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations (code);
CREATE INDEX IF NOT EXISTS idx_locations_zone ON locations (zone);
CREATE INDEX IF NOT EXISTS idx_audit_items_audit_id ON audit_items (audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_items_status ON audit_items (status);
CREATE INDEX IF NOT EXISTS idx_audit_items_product_id ON audit_items (product_id);
