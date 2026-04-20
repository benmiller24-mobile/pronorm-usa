-- ─────────────────────────────────────────────────────────────
-- Pronorm USA — Let dealer owners read their designers
--
-- Bug: after a dealer created a designer via the portal, the
-- designer row existed in `dealers` (inserted by invite-user
-- with service role, `parent_dealer_id = owner.id`, role = 'designer')
-- but was invisible in the "My Designers" tab. Root cause: the
-- existing RLS on `dealers` only lets a user SELECT their own row
-- (`auth.uid() = user_id`) or everything if role='admin'. There
-- was no policy letting a dealer see rows where
-- `parent_dealer_id = <their dealer id>`, so the team query
-- came back with only the owner's own row.
--
-- Fix: one additive SELECT policy on `dealers`. Inner SELECT is
-- self-referential but safe — it resolves via the existing
-- "Dealers: read own" policy, the same pattern the
-- "Dealers: admin read all" policy already uses.
--
-- Run in the Supabase SQL editor; idempotent.
-- ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Dealers: read my designers" ON dealers;

CREATE POLICY "Dealers: read my designers" ON dealers FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM dealers owner
    WHERE owner.user_id = auth.uid()
      AND owner.id = dealers.parent_dealer_id
  )
);
