-- =============================================
-- Pronorm USA — Add Designer Role (Upgrade Migration)
-- Run this if you already have the database set up and
-- need to add the designer role to an existing installation.
-- =============================================

-- 1. Add 'role' column if it doesn't exist, or add 'designer' to enum
-- If using the original schema without role column:
DO $$
BEGIN
  -- Check if role column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dealers' AND column_name = 'role'
  ) THEN
    -- Create enum and add column
    CREATE TYPE dealer_role AS ENUM ('dealer', 'admin', 'designer');
    ALTER TABLE dealers ADD COLUMN role dealer_role DEFAULT 'dealer' NOT NULL;
  ELSE
    -- Role column exists, add 'designer' to enum if missing
    ALTER TYPE dealer_role ADD VALUE IF NOT EXISTS 'designer';
  END IF;
END $$;

-- 2. Add RLS policies for designer access to projects
-- (These use IF NOT EXISTS pattern via DO blocks)

-- Designers + Admins can read all projects
DO $$ BEGIN
  CREATE POLICY "Projects: elevated read all" ON projects FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role IN ('admin', 'designer'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Designers + Admins can update all projects
DO $$ BEGIN
  CREATE POLICY "Projects: elevated update all" ON projects FOR UPDATE USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role IN ('admin', 'designer'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Designers + Admins can read all project files
DO $$ BEGIN
  CREATE POLICY "Project files: elevated read all" ON project_files FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role IN ('admin', 'designer'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Designers + Admins can insert project files for any project
DO $$ BEGIN
  CREATE POLICY "Project files: elevated insert all" ON project_files FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role IN ('admin', 'designer'))
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admin-only policies for orders, order files, order status updates, warranty
DO $$ BEGIN
  CREATE POLICY "Dealers: admin read all" ON dealers FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Orders: admin read all" ON orders FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Orders: admin update all" ON orders FOR UPDATE USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Order files: admin read all" ON order_files FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Order files: admin insert all" ON order_files FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Order updates: admin read all" ON order_status_updates FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Warranty: admin read all" ON warranty_claims FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Warranty files: admin read all" ON warranty_files FOR SELECT USING (
    EXISTS (SELECT 1 FROM dealers d WHERE d.user_id = auth.uid() AND d.role = 'admin')
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Done! Now create test users via Supabase Dashboard → Authentication → Users
-- See seed.sql for credentials and dealer INSERT statements.
