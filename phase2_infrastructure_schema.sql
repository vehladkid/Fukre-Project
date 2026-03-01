-- phase2_infrastructure_schema.sql
-- Urban Infrastructure Data Portal - Phase 2 Core Data Model

-- ====================================================
-- 1. DATABASE TABLES
-- ====================================================

-- 1) zones
CREATE TABLE zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2) infrastructure_categories
CREATE TABLE infrastructure_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3) asset_status
CREATE TABLE asset_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  severity_level INTEGER CHECK (severity_level BETWEEN 1 AND 5),
  color_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4) infrastructure_assets (CORE ENTITY)
CREATE TABLE infrastructure_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  description TEXT,

  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL,
  category_id UUID REFERENCES infrastructure_categories(id),
  status_id UUID REFERENCES asset_status(id),

  latitude NUMERIC,
  longitude NUMERIC,

  installation_date DATE,
  last_inspected TIMESTAMPTZ,

  created_by UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================================
-- AUTO UPDATE TRIGGER
-- ====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER sync_infrastructure_assets_updated_at
  BEFORE UPDATE ON infrastructure_assets
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- ====================================================
-- ROW LEVEL SECURITY
-- ====================================================

-- Enable RLS on all tables
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE infrastructure_assets ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------
-- ACCESS MODEL POLICIES
-- ----------------------------------------------------
-- The `role` column in `profiles` utilizes the `user_role` enum type
-- Valid Values: 'admin', 'operator', 'viewer' (all lowercase)

-- ZONES
CREATE POLICY "Zones SELECT Policy" ON zones FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator', 'viewer')
);

CREATE POLICY "Zones INSERT Policy" ON zones FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Zones UPDATE Policy" ON zones FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Zones DELETE Policy" ON zones FOR DELETE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- INFRASTRUCTURE_CATEGORIES
CREATE POLICY "Categories SELECT Policy" ON infrastructure_categories FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator', 'viewer')
);

CREATE POLICY "Categories INSERT Policy" ON infrastructure_categories FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Categories UPDATE Policy" ON infrastructure_categories FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Categories DELETE Policy" ON infrastructure_categories FOR DELETE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- ASSET_STATUS
CREATE POLICY "Status SELECT Policy" ON asset_status FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator', 'viewer')
);

CREATE POLICY "Status INSERT Policy" ON asset_status FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Status UPDATE Policy" ON asset_status FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Status DELETE Policy" ON asset_status FOR DELETE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- INFRASTRUCTURE_ASSETS
CREATE POLICY "Assets SELECT Policy" ON infrastructure_assets FOR SELECT TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator', 'viewer')
);

CREATE POLICY "Assets INSERT Policy" ON infrastructure_assets FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Assets UPDATE Policy" ON infrastructure_assets FOR UPDATE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'operator')
);

CREATE POLICY "Assets DELETE Policy" ON infrastructure_assets FOR DELETE TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- ====================================================
-- SEED DATA
-- ====================================================

INSERT INTO zones (name, description) VALUES
  ('Downtown', 'Central business district and core city area.'),
  ('Industrial Zone', 'Manufacturing and heavy industry region.'),
  ('Residential Sector', 'Primary housing and residential neighborhoods.')
ON CONFLICT (name) DO NOTHING;

INSERT INTO infrastructure_categories (name, icon) VALUES
  ('Road', 'road'),
  ('Bridge', 'bridge'),
  ('Utility', 'utility'),
  ('Building', 'building'),
  ('Street Light', 'lightbulb')
ON CONFLICT (name) DO NOTHING;

-- Changed severity_level to id, wait no, they don't have unique constraint.
-- Actually the previous query didn't have UNIQUE constraint on severity_level, but it had on name.
INSERT INTO asset_status (name, severity_level, color_code) VALUES
  ('Operational', 1, '#10b981'),
  ('Maintenance Required', 3, '#f59e0b'),
  ('Under Repair', 4, '#f97316'),
  ('Critical', 5, '#ef4444')
ON CONFLICT (name) DO NOTHING;

-- ====================================================
-- INDEXING
-- ====================================================

CREATE INDEX IF NOT EXISTS idx_infra_assets_zone_id ON infrastructure_assets(zone_id);
CREATE INDEX IF NOT EXISTS idx_infra_assets_category_id ON infrastructure_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_infra_assets_status_id ON infrastructure_assets(status_id);
CREATE INDEX IF NOT EXISTS idx_infra_assets_location ON infrastructure_assets(latitude, longitude);
