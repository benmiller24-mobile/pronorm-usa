-- =============================================
-- Pronorm USA Dealer Portal — Database Migration
-- Run this in your Supabase SQL Editor
-- =============================================

-- ── Enums ──
CREATE TYPE project_status AS ENUM (
  'submitted',            -- Dealer submitted design packet
  'in_design',            -- Pronorm USA is designing
  'design_delivered',     -- Design output package ready for dealer review
  'changes_requested',    -- Dealer marked up changes
  'design_revised',       -- Pronorm revised design (can loop back)
  'approved'              -- Dealer approved design → ready for order
);

CREATE TYPE order_status AS ENUM (
  'pending_order_payment',    -- Awaiting order payment (QuickBooks)
  'order_paid',               -- Order payment received
  'sent_to_factory',          -- Sent to pronorm factory in Germany
  'acknowledgement_review',   -- Factory confirmation uploaded for dealer review
  'acknowledgement_changes',  -- Dealer marked up changes on confirmation
  'acknowledgement_approved', -- Dealer approved factory confirmation
  'in_production',            -- Manufacturing in progress
  'shipped',                  -- Order shipped from factory
  'pending_shipping_payment', -- Awaiting shipping/balance payment
  'shipping_paid',            -- Shipping payment received
  'delivered'                 -- Delivered to dealer/client
);

CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');
CREATE TYPE warranty_status AS ENUM ('submitted', 'under_review', 'approved', 'shipped', 'resolved', 'denied');

CREATE TYPE file_category AS ENUM (
  'submission',               -- Dealer's original design packet files
  'design_output',            -- Pronorm's design output package
  'dealer_markup',            -- Dealer's marked-up changes
  'design_revision',          -- Pronorm's revised design files
  'acknowledgement',          -- Factory order confirmation PDF
  'acknowledgement_markup'    -- Dealer's markup on factory confirmation
);

CREATE TYPE order_file_category AS ENUM ('acknowledgement', 'acknowledgement_markup', 'other');
CREATE TYPE uploader_role AS ENUM ('dealer', 'admin');

-- ── Dealers ──
CREATE TABLE dealers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text DEFAULT '',
  address text DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ── Projects ──
CREATE TABLE projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
  job_name text NOT NULL,
  client_name text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  status project_status DEFAULT 'submitted' NOT NULL,
  admin_notes text,
  quote_amount numeric,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ── Project Files (with category tracking) ──
CREATE TABLE project_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0,
  category file_category NOT NULL DEFAULT 'submission',
  uploaded_by uploader_role NOT NULL DEFAULT 'dealer',
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- ── Orders ──
CREATE TABLE orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
  order_number text NOT NULL UNIQUE,
  status order_status DEFAULT 'pending_order_payment' NOT NULL,
  total_amount numeric NOT NULL DEFAULT 0,
  shipping_amount numeric,
  quickbooks_order_invoice_id text,
  quickbooks_shipping_invoice_id text,
  payment_status payment_status DEFAULT 'unpaid' NOT NULL,
  shipping_payment_status payment_status DEFAULT 'unpaid' NOT NULL,
  shipping_tracking text,
  shipping_carrier text,
  estimated_delivery date,
  production_started_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ── Order Files (acknowledgements + markups) ──
CREATE TABLE order_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0,
  category order_file_category NOT NULL DEFAULT 'acknowledgement',
  uploaded_by uploader_role NOT NULL DEFAULT 'admin',
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- ── Order Status Updates ──
CREATE TABLE order_status_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  old_status text NOT NULL,
  new_status text NOT NULL,
  note text,
  updated_by text NOT NULL DEFAULT 'system',
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ── Warranty Claims ──
CREATE TABLE warranty_claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  dealer_id uuid REFERENCES dealers(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  status warranty_status DEFAULT 'submitted' NOT NULL,
  resolution_notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ── Warranty Files ──
CREATE TABLE warranty_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  warranty_id uuid REFERENCES warranty_claims(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  uploaded_at timestamptz DEFAULT now() NOT NULL
);

-- ── Updated_at Trigger ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER warranty_claims_updated_at BEFORE UPDATE ON warranty_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Row Level Security ──
ALTER TABLE dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranty_files ENABLE ROW LEVEL SECURITY;

-- Dealers
CREATE POLICY "Dealers: read own" ON dealers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Dealers: update own" ON dealers FOR UPDATE USING (auth.uid() = user_id);

-- Projects
CREATE POLICY "Projects: read own" ON projects FOR SELECT USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "Projects: insert own" ON projects FOR INSERT WITH CHECK (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "Projects: update own" ON projects FOR UPDATE USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));

-- Project Files
CREATE POLICY "Project files: read own" ON project_files FOR SELECT USING (project_id IN (SELECT id FROM projects WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())));
CREATE POLICY "Project files: insert own" ON project_files FOR INSERT WITH CHECK (project_id IN (SELECT id FROM projects WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())));

-- Orders
CREATE POLICY "Orders: read own" ON orders FOR SELECT USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "Orders: update own" ON orders FOR UPDATE USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));

-- Order Files
CREATE POLICY "Order files: read own" ON order_files FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())));
CREATE POLICY "Order files: insert own" ON order_files FOR INSERT WITH CHECK (order_id IN (SELECT id FROM orders WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())));

-- Order Status Updates
CREATE POLICY "Order updates: read own" ON order_status_updates FOR SELECT USING (order_id IN (SELECT id FROM orders WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())));

-- Warranty Claims
CREATE POLICY "Warranty: read own" ON warranty_claims FOR SELECT USING (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));
CREATE POLICY "Warranty: insert own" ON warranty_claims FOR INSERT WITH CHECK (dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid()));

-- Warranty Files
CREATE POLICY "Warranty files: read own" ON warranty_files FOR SELECT USING (warranty_id IN (SELECT id FROM warranty_claims WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())));
CREATE POLICY "Warranty files: insert own" ON warranty_files FOR INSERT WITH CHECK (warranty_id IN (SELECT id FROM warranty_claims WHERE dealer_id IN (SELECT id FROM dealers WHERE user_id = auth.uid())));

-- ── Storage Buckets ──
-- Create in Supabase Dashboard → Storage:
-- 1. "project-files" (private, 50MB max file size)
-- 2. "order-files" (private, 50MB max file size)
-- 3. "warranty-files" (private, 20MB max file size)

-- ── Indexes ──
CREATE INDEX idx_projects_dealer_id ON projects(dealer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_project_files_category ON project_files(category);
CREATE INDEX idx_orders_dealer_id ON orders(dealer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_files_order_id ON order_files(order_id);
CREATE INDEX idx_order_status_updates_order_id ON order_status_updates(order_id);
CREATE INDEX idx_warranty_claims_dealer_id ON warranty_claims(dealer_id);
CREATE INDEX idx_warranty_claims_order_id ON warranty_claims(order_id);
