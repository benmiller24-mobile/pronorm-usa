-- =====================================================================
-- Pronorm dealer portal — lock down 12 unused public tables  (2026-10-29)
-- Run once in Supabase → SQL Editor for project zsbzyazabqtjamhzqqxn
-- (pronorm-dealer-portal). Safe to re-run. Reversible (see bottom).
--
-- These tables have row-level security OFF, so anyone holding the public
-- anon key (which ships in pronormusa.com's JavaScript) can read, insert
-- and delete rows. No code in the pronorm-usa repo references them; as of
-- 2026-10-29 they hold 4 rows total (1 lead_event, 1 mood_board,
-- 2 project_briefs).
--
-- Enabling RLS with NO policies denies all access to anon/authenticated
-- while the service role (server functions, SQL editor) still works.
-- Nothing is deleted. Once you confirm nothing needs them, you can DROP them.
-- =====================================================================

alter table public.analytics_snapshots   enable row level security;
alter table public.brand_interactions    enable row level security;
alter table public.brand_partners        enable row level security;
alter table public.competitor_benchmarks enable row level security;
alter table public.lead_credit_packages  enable row level security;
alter table public.lead_events           enable row level security;
alter table public.mood_board_items      enable row level security;
alter table public.mood_boards           enable row level security;
alter table public.project_briefs        enable row level security;
alter table public.rfq_responses         enable row level security;
alter table public.showroom_photos       enable row level security;
alter table public.sponsored_placements  enable row level security;

revoke all on public.analytics_snapshots, public.brand_interactions, public.brand_partners,
  public.competitor_benchmarks, public.lead_credit_packages, public.lead_events,
  public.mood_board_items, public.mood_boards, public.project_briefs, public.rfq_responses,
  public.showroom_photos, public.sponsored_placements
  from anon, authenticated;

-- Advisor hygiene
alter function public.update_updated_at() set search_path = public;

-- Verify: should return zero rows.
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- To undo for a table:  alter table public.<name> disable row level security;
