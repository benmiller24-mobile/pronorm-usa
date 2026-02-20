-- =============================================
-- Pronorm USA — Seed Test Users
-- Run in Supabase SQL Editor AFTER migration.sql
-- =============================================
--
-- STEP 1: Create auth users in Supabase Dashboard → Authentication → Users → "Add User"
--
--   Admin:    admin@pronormusa.com     / PronormAdmin2026!
--   Dealer:   dealer@pronormusa.com    / PronormDealer2026!
--   Designer: designer@pronormusa.com  / PronormDesign2026!
--
-- STEP 2: Copy the UUID for each user from the Authentication → Users table
--         and replace the placeholders below.

-- Admin (Pronorm USA internal)
INSERT INTO dealers (user_id, company_name, contact_name, email, phone, role)
VALUES (
  'AUTH_USER_ID_ADMIN',        -- ← replace with UUID
  'Pronorm USA',
  'Ben Miller',
  'admin@pronormusa.com',
  '303-555-0100',
  'admin'
);

-- Dealer (test dealership)
INSERT INTO dealers (user_id, company_name, contact_name, email, phone, role)
VALUES (
  'AUTH_USER_ID_DEALER',       -- ← replace with UUID
  'Elmhurst Kitchen & Bath',
  'Test Dealer',
  'dealer@pronormusa.com',
  '303-555-0300',
  'dealer'
);

-- Designer (nested under the dealer above)
-- NOTE: Run the dealer INSERT first, then grab the dealer's `id` from the
-- dealers table and replace AUTH_DEALER_ROW_ID below.
INSERT INTO dealers (user_id, company_name, contact_name, email, phone, role, parent_dealer_id)
VALUES (
  'AUTH_USER_ID_DESIGNER',     -- ← replace with auth UUID
  'Elmhurst Kitchen & Bath',   -- same company as parent dealer
  'Kitchen Designer',
  'designer@pronormusa.com',
  '303-555-0200',
  'designer',
  'AUTH_DEALER_ROW_ID'         -- ← replace with the dealer's row id from dealers table
);
