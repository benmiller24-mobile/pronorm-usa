-- Adds 'appliance_spec' to the file_category enum so dealers can upload
-- appliance spec sheets (PDFs) as a distinct category on project creation.
-- Run this in the Supabase SQL editor before deploying the code change.
--
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction,
-- which the Supabase SQL editor handles by default.
ALTER TYPE file_category ADD VALUE IF NOT EXISTS 'appliance_spec';
