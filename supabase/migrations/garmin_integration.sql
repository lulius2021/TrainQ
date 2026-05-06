-- Garmin Connect Integration Tables
-- Run this in Supabase Dashboard > SQL Editor

-- 1. OAuth Temporary Tokens (request tokens during auth flow, auto-expire 10min)
CREATE TABLE IF NOT EXISTS garmin_oauth_temp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_token TEXT NOT NULL,
  request_token_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_got_token ON garmin_oauth_temp(request_token);

ALTER TABLE garmin_oauth_temp ENABLE ROW LEVEL SECURITY;
-- Service role only — no user-facing policies

-- 2. Access Tokens (one per user)
CREATE TABLE IF NOT EXISTS garmin_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  garmin_user_id TEXT,
  access_token TEXT NOT NULL,
  token_secret TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_gt_garmin_uid ON garmin_tokens(garmin_user_id);

ALTER TABLE garmin_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own tokens" ON garmin_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- 3. Raw Webhook Events (audit trail, idempotent)
CREATE TABLE IF NOT EXISTS garmin_raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  garmin_user_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_gre_garmin_uid ON garmin_raw_events(garmin_user_id);
CREATE INDEX IF NOT EXISTS idx_gre_unprocessed ON garmin_raw_events(processed_at) WHERE processed_at IS NULL;

ALTER TABLE garmin_raw_events ENABLE ROW LEVEL SECURITY;
-- Service role only

-- 4. Normalized Activities
CREATE TABLE IF NOT EXISTS garmin_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garmin_activity_id TEXT NOT NULL,
  activity_type TEXT,
  start_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  distance_meters REAL,
  calories INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_speed REAL,
  steps INTEGER,
  summary_json JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, garmin_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_ga_user ON garmin_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_ga_start ON garmin_activities(user_id, start_time);

ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own activities" ON garmin_activities
  FOR SELECT USING (auth.uid() = user_id);

-- 5. Normalized Sleep Summaries
CREATE TABLE IF NOT EXISTS garmin_sleep_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garmin_summary_id TEXT NOT NULL,
  calendar_date DATE NOT NULL,
  sleep_start TIMESTAMPTZ,
  sleep_end TIMESTAMPTZ,
  total_sleep_seconds INTEGER,
  deep_sleep_seconds INTEGER,
  light_sleep_seconds INTEGER,
  rem_sleep_seconds INTEGER,
  awake_seconds INTEGER,
  sleep_score INTEGER,
  summary_json JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, garmin_summary_id)
);

CREATE INDEX IF NOT EXISTS idx_gss_user_date ON garmin_sleep_summaries(user_id, calendar_date);

ALTER TABLE garmin_sleep_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own sleep" ON garmin_sleep_summaries
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Normalized Daily Metrics
CREATE TABLE IF NOT EXISTS garmin_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garmin_summary_id TEXT NOT NULL,
  calendar_date DATE NOT NULL,
  steps INTEGER,
  distance_meters REAL,
  active_calories INTEGER,
  total_calories INTEGER,
  resting_heart_rate INTEGER,
  max_heart_rate INTEGER,
  avg_stress_level INTEGER,
  body_battery_high INTEGER,
  body_battery_low INTEGER,
  floors_climbed INTEGER,
  intensity_minutes INTEGER,
  summary_json JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, garmin_summary_id)
);

CREATE INDEX IF NOT EXISTS idx_gdm_user_date ON garmin_daily_metrics(user_id, calendar_date);

ALTER TABLE garmin_daily_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own metrics" ON garmin_daily_metrics
  FOR SELECT USING (auth.uid() = user_id);

-- 7. Dead Letter Queue (failed webhook processing)
CREATE TABLE IF NOT EXISTS garmin_dead_letter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_event_id UUID REFERENCES garmin_raw_events(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  error_message TEXT,
  stack_trace TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gdl_retry ON garmin_dead_letter(next_retry_at) WHERE resolved_at IS NULL;

ALTER TABLE garmin_dead_letter ENABLE ROW LEVEL SECURITY;
-- Service role only

-- Cleanup function for expired OAuth temp rows
CREATE OR REPLACE FUNCTION cleanup_expired_garmin_oauth_temp()
RETURNS void AS $$
BEGIN
  DELETE FROM garmin_oauth_temp WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
