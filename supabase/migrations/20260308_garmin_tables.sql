-- Garmin OAuth temp table for PKCE flow
CREATE TABLE IF NOT EXISTS garmin_oauth_temp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

-- Garmin tokens
CREATE TABLE IF NOT EXISTS garmin_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  garmin_user_id TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  connected_at TIMESTAMPTZ DEFAULT now(),
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- Garmin daily metrics
CREATE TABLE IF NOT EXISTS garmin_daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  steps INTEGER,
  heart_rate_resting INTEGER,
  body_battery_high INTEGER,
  body_battery_low INTEGER,
  stress_avg INTEGER,
  intensity_minutes INTEGER,
  floors_climbed INTEGER,
  active_calories INTEGER,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, calendar_date)
);

-- Garmin sleep summaries
CREATE TABLE IF NOT EXISTS garmin_sleep_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  sleep_score INTEGER,
  duration_seconds INTEGER,
  deep_seconds INTEGER,
  light_seconds INTEGER,
  rem_seconds INTEGER,
  awake_seconds INTEGER,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, calendar_date)
);

-- Garmin activities
CREATE TABLE IF NOT EXISTS garmin_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garmin_activity_id TEXT NOT NULL,
  activity_type TEXT,
  start_time TIMESTAMPTZ,
  duration_seconds INTEGER,
  distance_meters REAL,
  calories INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  raw_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, garmin_activity_id)
);

-- garmin_data column added via 20260308100000_garmin_posts_column.sql (table is "posts")
