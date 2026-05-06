-- Migration: profiles subscription columns + signup trigger + RLS + RC events
-- Applied: 2026-05-06

-- ── profiles: subscription tracking ──────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_platform TEXT,
  ADD COLUMN IF NOT EXISTS subscription_product_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- Auto-create profile row on new auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, is_pro, onboarding_completed)
  VALUES (NEW.id, false, false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- profile-specific updated_at trigger (namespaced to avoid collision)
CREATE OR REPLACE FUNCTION profiles_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_set_updated_at();

-- Service role policy for webhook writes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Service role full access profiles'
  ) THEN
    CREATE POLICY "Service role full access profiles" ON profiles
      USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── revenuecat_events: webhook idempotency ──────────────────────────────────

CREATE TABLE IF NOT EXISTS revenuecat_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rc_events_user_id ON revenuecat_events(user_id);
CREATE INDEX IF NOT EXISTS idx_rc_events_processed_at ON revenuecat_events(processed_at);

ALTER TABLE revenuecat_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'revenuecat_events' AND policyname = 'Service role only'
  ) THEN
    CREATE POLICY "Service role only" ON revenuecat_events
      USING (false) WITH CHECK (false);
  END IF;
END $$;
