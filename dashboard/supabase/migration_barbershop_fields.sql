-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Add missing columns to businesses table
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS email          text,
  ADD COLUMN IF NOT EXISTS description    text;

-- 2. Ensure plan has a default
ALTER TABLE public.businesses
  ALTER COLUMN plan SET DEFAULT 'demo';

-- 3. RLS: owners can insert their own businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'businesses' AND policyname = 'Owners can insert businesses'
  ) THEN
    CREATE POLICY "Owners can insert businesses"
      ON public.businesses FOR INSERT
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

-- 4. RLS: members can read their businesses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'businesses' AND policyname = 'Members can read their businesses'
  ) THEN
    CREATE POLICY "Members can read their businesses"
      ON public.businesses FOR SELECT
      USING (
        id IN (SELECT business_id FROM public.business_members WHERE user_id = auth.uid())
        OR owner_id = auth.uid()
      );
  END IF;
END $$;

-- 5. RLS: allow members to insert themselves (owner adds themselves after creating biz)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_members' AND policyname = 'Users can insert their own membership'
  ) THEN
    CREATE POLICY "Users can insert their own membership"
      ON public.business_members FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Add services JSONB array for multi-barber bookings
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS services JSONB;
