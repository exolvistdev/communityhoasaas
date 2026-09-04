-- Enable Row Level Security on every table in `public`, with zero policies and
-- no FORCE. Prisma connects as the table-owning role and always bypasses RLS
-- regardless of this flag, so this is a no-op for the app. Its only effect is
-- to deny Supabase's PostgREST Data API (the `anon` / `authenticated` Postgres
-- roles) — which the app never uses to reach these tables, but which is
-- otherwise reachable from the internet with the project's public anon key.
-- See docs/rls-design.md for the fuller, still-deferred, app-level-isolation
-- design (FORCE + per-org policies + a session GUC).
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Belt-and-suspenders: anon/authenticated should have no standing privileges
-- on these tables at all (today or for any table added later).
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
