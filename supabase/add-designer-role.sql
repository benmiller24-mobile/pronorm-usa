-- =============================================
-- Pronorm USA — Add Designer Role (Upgrade Migration)
-- Run this if you already have the database set up and
-- need to add the designer role to an existing installation.
-- =============================================

-- 1. Add 'role' and 'parent_dealer_id' columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'dealer_role') THEN
    CREATE TYPE dealer_role AS ENUM ('dealer', 'admin', 'designer');
  ELSE
    ALTER TYPE dealer_role ADD VALUE IF NOT EXISTS 'designer';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dealers' AND column_name = 'role'
  ) THEN
    ALTER TABLE dealers ADD COLUMN role dealer_role DEFAULT 'dealer' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dealers' AND column_name = 'parent_dealer_id'
  ) THEN
    ALTER TABLE dealers ADD COLUMN parent_dealer_id uuid REFERENCES dealers(id) ON DELETE SET NULL DEFAULT NULL;
  END IF;
END $$;

-- 2. Drop old policies
DROP POLICY IF EXISTS "Projects: read own" ON projects;
DROP POLICY IF EXISTS "Projects: insert own" ON projects;
DROP POLICY IF EXISTS "Projects: update own" ON projects;
DROP POLICY IF EXISTS "Projects: elevated read all" ON projects;
DROP POLICY IF EXISTS "Projects: elevated update all" ON projects;
DROP POLICY IF EXISTS "Project files: read own" ON project_files;
DROP POLICY IF EXISTS "Project files: insert own" ON project_files;
DROP POLICY IF EXISTS "Project files: elevated read all" ON project_files;
DROP POLICY IF EXISTS "Project files: elevated insert all" ON project_files;
DROP POLICY IF EXISTS "Orders: read own" ON orders;
DROP POLICY IF EXISTS "Orders: update own" ON orders;
DROP POLICY IF EXISTS "Orders: admin read all" ON orders;
DROP POLICY IF EXISTS "Orders: admin update all" ON orders;
DROP POLICY IF EXISTS "Order files: read own" ON order_files;
DROP POLICY IF EXISTS "Order files: insert own" ON order_files;
DROP POLICY IF EXISTS "Order files: admin read all" ON order_files;
DROP POLICY IF EXISTS "Order files: admin insert all" ON order_files;
DROP POLICY IF EXISTS "Order updates: read own" ON order_status_updates;
DROP POLICY IF EXISTS "Order updates: admin read all" ON order_status_updates;
DROP POLICY IF EXISTS "Warranty: read own" ON warranty_claims;
DROP POLICY IF EXISTS "Warranty: insert own" ON warranty_claims;
DROP POLICY IF EXISTS "Warranty: admin read all" ON warranty_claims;
DROP POLICY IF EXISTS "Warranty files: read own" ON warranty_files;
DROP POLICY IF EXISTS "Warranty files: insert own" ON warranty_files;
DROP POLICY IF EXISTS "Warranty files: admin read all" ON warranty_files;

-- 3. Create unified policies
-- Admin: sees all | Dealer: sees own | Designer: sees parent dealer's data

CREATE POLICY "Projects: read accessible" ON projects FOR SELECT USING (
  EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid()
    AND (d.role = 'admin' OR d.id = projects.dealer_id OR d.parent_dealer_id = projects.dealer_id))
);
CREATE POLICY "Projects: insert accessible" ON projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid()
    AND (d.role = 'admin' OR d.id = projects.dealer_id OR d.parent_dealer_id = projects.dealer_id))
);
CREATE POLICY "Projects: update accessible" ON projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid()
    AND (d.role = 'admin' OR d.id = projects.dealer_id OR d.parent_dealer_id = projects.dealer_id))
);

CREATE POLICY "Project files: read accessible" ON project_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects p JOIN dealers d ON d.user_id = auth.uid()
    WHERE p.id = project_files.project_id
    AND (d.role = 'admin' OR d.id = p.dealer_id OR d.parent_dealer_id = p.dealer_id))
);
CREATE POLICY "Project files: insert accessible" ON project_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM projects p JOIN dealers d ON d.user_id = auth.uid()
    WHERE p.id = project_files.project_id
    AND (d.role = 'admin' OR d.id = p.dealer_id OR d.parent_dealer_id = p.dealer_id))
);

CREATE POLICY "Orders: read accessible" ON orders FOR SELECT USING (
  EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid()
    AND (d.role = 'admin' OR d.id = orders.dealer_id OR d.parent_dealer_id = orders.dealer_id))
);
CREATE POLICY "Orders: update accessible" ON orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid()
    AND (d.role = 'admin' OR d.id = orders.dealer_id OR d.parent_dealer_id = orders.dealer_id))
);

CREATE POLICY "Order files: read accessible" ON order_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o JOIN dealers d ON d.user_id = auth.uid()
    WHERE o.id = order_files.order_id
    AND (d.role = 'admin' OR d.id = o.dealer_id OR d.parent_dealer_id = o.dealer_id))
);
CREATE POLICY "Order files: insert accessible" ON order_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders o JOIN dealers d ON d.user_id = auth.uid()
    WHERE o.id = order_files.order_id
    AND (d.role = 'admin' OR d.id = o.dealer_id OR d.parent_dealer_id = o.dealer_id))
);

CREATE POLICY "Order updates: read accessible" ON order_status_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o JOIN dealers d ON d.user_id = auth.uid()
    WHERE o.id = order_status_updates.order_id
    AND (d.role = 'admin' OR d.id = o.dealer_id OR d.parent_dealer_id = o.dealer_id))
);

CREATE POLICY "Warranty: read accessible" ON warranty_claims FOR SELECT USING (
  EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid()
    AND (d.role = 'admin' OR d.id = warranty_claims.dealer_id OR d.parent_dealer_id = warranty_claims.dealer_id))
);
CREATE POLICY "Warranty: insert accessible" ON warranty_claims FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid()
    AND (d.role = 'admin' OR d.id = warranty_claims.dealer_id OR d.parent_dealer_id = warranty_claims.dealer_id))
);

CREATE POLICY "Warranty files: read accessible" ON warranty_files FOR SELECT USING (
  EXISTS (SELECT 1 FROM warranty_claims w JOIN dealers d ON d.user_id = auth.uid()
    WHERE w.id = warranty_files.warranty_id
    AND (d.role = 'admin' OR d.id = w.dealer_id OR d.parent_dealer_id = w.dealer_id))
);
CREATE POLICY "Warranty files: insert accessible" ON warranty_files FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM warranty_claims w JOIN dealers d ON d.user_id = auth.uid()
    WHERE w.id = warranty_files.warranty_id
    AND (d.role = 'admin' OR d.id = w.dealer_id OR d.parent_dealer_id = w.dealer_id))
);
