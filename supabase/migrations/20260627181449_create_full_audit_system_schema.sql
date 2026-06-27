/*
# Warehouse Audit System — Full Schema

## Tables
1. warehouses — warehouse master
2. users — user profiles with roles (extends auth.users)
3. products — product master with QR codes, prices, locations
4. audit_header — audit sessions with workflow status
5. audit_details — per-product audit counts with variance tracking
6. audit_log — append-only audit trail
7. notifications — in-app + email notifications
8. settings — system configuration
*/

CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_warehouses" ON warehouses;
CREATE POLICY "read_warehouses" ON warehouses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_warehouses" ON warehouses;
CREATE POLICY "write_warehouses" ON warehouses FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'viewer',
  warehouse text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_users" ON users;
CREATE POLICY "read_users" ON users FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "update_own_profile" ON users;
CREATE POLICY "update_own_profile" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON users;
CREATE POLICY "insert_own_profile" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code text UNIQUE NOT NULL,
  qr_code text UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  brand text,
  unit text NOT NULL DEFAULT 'pcs',
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  zone text,
  rack_number text,
  bin_number text,
  system_quantity integer NOT NULL DEFAULT 0,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_products" ON products;
CREATE POLICY "read_products" ON products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS audit_header (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_name text NOT NULL,
  audit_type text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'draft',
  assigned_to uuid REFERENCES users(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL,
  filter_criteria jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  assigned_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  closed_at timestamptz,
  notes text
);
ALTER TABLE audit_header ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_audit_header" ON audit_header;
CREATE POLICY "read_audit_header" ON audit_header FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_audit_header" ON audit_header;
CREATE POLICY "insert_audit_header" ON audit_header FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_audit_header" ON audit_header;
CREATE POLICY "update_audit_header" ON audit_header FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_audit_header" ON audit_header;
CREATE POLICY "delete_audit_header" ON audit_header FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS audit_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES audit_header(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  system_quantity integer NOT NULL DEFAULT 0,
  physical_quantity integer,
  variance_quantity integer,
  variance_value numeric(12,2),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  scanned boolean NOT NULL DEFAULT false,
  scan_count integer NOT NULL DEFAULT 0,
  note text,
  counted_by uuid REFERENCES users(id) ON DELETE SET NULL,
  counted_at timestamptz,
  recount_approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  recount_approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (audit_id, product_id)
);
ALTER TABLE audit_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_audit_details" ON audit_details;
CREATE POLICY "read_audit_details" ON audit_details FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_audit_details" ON audit_details;
CREATE POLICY "insert_audit_details" ON audit_details FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_audit_details" ON audit_details;
CREATE POLICY "update_audit_details" ON audit_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_audit_details" ON audit_details;
CREATE POLICY "delete_audit_details" ON audit_details FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid REFERENCES audit_header(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_audit_log" ON audit_log;
CREATE POLICY "read_audit_log" ON audit_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_audit_log" ON audit_log;
CREATE POLICY "insert_audit_log" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audit_header(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_notifications" ON notifications;
CREATE POLICY "read_notifications" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_notifications" ON notifications;
CREATE POLICY "update_notifications" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read_settings" ON settings;
CREATE POLICY "read_settings" ON settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "write_settings" ON settings;
CREATE POLICY "write_settings" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_products_product_code ON products (product_code);
CREATE INDEX IF NOT EXISTS idx_products_qr_code ON products (qr_code);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_warehouse_id ON products (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_products_zone ON products (zone);
CREATE INDEX IF NOT EXISTS idx_products_status ON products (status);
CREATE INDEX IF NOT EXISTS idx_audit_header_status ON audit_header (status);
CREATE INDEX IF NOT EXISTS idx_audit_header_assigned_to ON audit_header (assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_header_warehouse_id ON audit_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_audit_header_audit_type ON audit_header (audit_type);
CREATE INDEX IF NOT EXISTS idx_audit_details_audit_id ON audit_details (audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_details_product_id ON audit_details (product_id);
CREATE INDEX IF NOT EXISTS idx_audit_details_status ON audit_details (status);
CREATE INDEX IF NOT EXISTS idx_audit_log_audit_id ON audit_log (audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);

INSERT INTO settings (key, value, description) VALUES
  ('large_variance_threshold', '"10"', 'Variance percentage threshold for large variance alerts'),
  ('default_warehouse', '"WH-01"', 'Default warehouse code'),
  ('email_notifications_enabled', 'true', 'Whether email notifications are enabled')
ON CONFLICT (key) DO NOTHING;
