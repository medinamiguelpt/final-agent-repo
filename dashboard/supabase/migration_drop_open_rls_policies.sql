-- ──────────────────────────────────────────────────────────────────────────────
-- Drop overly-permissive "Service role can manage" RLS policies
--
-- These policies used USING (true) WITH CHECK (true), which granted ALL
-- authenticated users full access to every row — not just service_role.
-- The service_role key already bypasses RLS, so these policies were both
-- unnecessary and dangerous.
--
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Service role can manage agents"       ON public.agents;
DROP POLICY IF EXISTS "Service role can manage calls"        ON public.calls;
DROP POLICY IF EXISTS "Service role can manage appointments" ON public.appointments;
