-- =============================================
-- Pronorm USA — Seed Test Users
-- Run this in your Supabase SQL Editor AFTER migration.sql
-- =============================================
--
-- STEP 1: Create auth users in Supabase Dashboard → Authentication → Users → "Add User"
--
--   Admin Test User:
--     Email:    admin@pronormusa.com
--     Password: PronormAdmin2026!
--
--   Designer Test User:
--     Email:    designer@pronormusa.com
--     Password: PronormDesign2026!
--
--   Dealer Test User:
--     Email:    dealer@pronormusa.com
--     Password: PronormDealer2026!
--
-- STEP 2: After creating the auth users above, get their user IDs from the
--         Authentication → Users table and replace the placeholders below:

-- Replace 'AUTH_USER_ID_ADMIN' with the actual UUID from auth.users
INSERT INTO dealers (user_id, company_name, contact_name, email, phone, role) VALUES
  ('AUTH_USER_ID_ADMIN', 'Pronorm USA', 'Ben Miller', 'admin@pronormusa.com', '303-555-0100', 'admin');

-- Replace 'AUTH_USER_ID_DESIGNER' with the actual UUID from auth.users
INSERT INTO dealers (user_id, company_name, contact_name, email, phone, role) VALUES
  ('AUTH_USER_ID_DESIGNER', 'Pronorm USA Design', 'Kitchen Designer', 'designer@pronormusa.com', '303-555-0200', 'designer');

-- Replace 'AUTH_USER_ID_DEALER' with the actual UUID from auth.users
INSERT INTO dealers (user_id, company_name, contact_name, email, phone, role) VALUES
  ('AUTH_USER_ID_DEALER', 'Elmhurst Kitchen & Bath', 'Test Dealer', 'dealer@pronormusa.com', '303-555-0300', 'dealer');

-- =============================================
-- QUICK SETUP (if you want to do it all in SQL):
-- =============================================
-- You can also create auth users via SQL if you prefer:
--
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
-- VALUES (
--   gen_random_uuid(),
--   'admin@pronormusa.com',
--   crypt('PronormAdmin2026!', gen_salt('bf')),
--   now(),
--   '{"provider":"email","providers":["email"]}',
--   '{}',
--   now(),
--   now()
-- );
--
-- Then use the generated UUID in the dealers INSERT above.
