-- ============================================================
-- TrainQ Wellness & Training Load Schema Extensions
-- Run in Supabase SQL Editor — safe to re-run (IF NOT EXISTS)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EXTEND garmin_daily_metrics with wellness columns
--    (the table already exists from COMBINED_SETUP.sql)
-- ────────────────────────────────────────────────────────────

ALTER TABLE garmin_daily_metrics
  ADD COLUMN IF NOT EXISTS hrv_weekly_avg    NUMERIC,
  ADD COLUMN IF NOT EXISTS hrv_status        TEXT,
  ADD COLUMN IF NOT EXISTS sleep_hours       NUMERIC,
  ADD COLUMN IF NOT EXISTS sleep_quality     INTEGER,
  ADD COLUMN IF NOT EXISTS wellbeing_score   INTEGER,     -- 1–10 (subjective)
  ADD COLUMN IF NOT EXISTS recovery_score    INTEGER,     -- 0–100 (computed)
  ADD COLUMN IF NOT EXISTS training_status   TEXT;        -- Productive/Peaking/Recovery/Overreaching/Detraining

-- ────────────────────────────────────────────────────────────
-- 2. DAILY WELLNESS (subjective check-ins — alternative to Garmin)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_wellness (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_date    DATE NOT NULL,
  wellbeing_score  INTEGER CHECK (wellbeing_score BETWEEN 1 AND 10),
  sleep_hours      NUMERIC,
  sleep_quality    INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, calendar_date)
);

ALTER TABLE daily_wellness ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "daily_wellness_owner" ON daily_wellness
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. TRAINING LOAD SNAPSHOTS (daily ACWR / CTL / ATL / TSB)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_load (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendar_date DATE NOT NULL,
  -- Per-sport loads (arbitrary units = RPE × hours × 10)
  gym_load      NUMERIC DEFAULT 0,
  run_load      NUMERIC DEFAULT 0,
  bike_load     NUMERIC DEFAULT 0,
  total_load    NUMERIC DEFAULT 0,
  -- PMC metrics
  ctl           NUMERIC,   -- Chronic Training Load (42-day EWMA)
  atl           NUMERIC,   -- Acute Training Load (7-day EWMA)
  tsb           NUMERIC,   -- Training Stress Balance
  acwr          NUMERIC,   -- Acute:Chronic Workload Ratio
  training_status TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, calendar_date)
);

ALTER TABLE training_load ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "training_load_owner" ON training_load
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. DELOAD HISTORY (post-deload feedback & performance tracking)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deload_history (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  trigger_score    INTEGER,                    -- 0–100
  trigger_reasons  TEXT[],                     -- array of factor keys
  deload_type      TEXT,                       -- leicht / mittel / intensiv
  pre_performance  NUMERIC,                    -- avg load/volume before deload
  post_performance NUMERIC,                    -- avg load/volume after deload
  user_feedback    INTEGER CHECK (user_feedback BETWEEN 1 AND 10),
  created_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE deload_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "deload_history_owner" ON deload_history
  USING (auth.uid() = user_id);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_wellness_user_date ON daily_wellness(user_id, calendar_date DESC);
CREATE INDEX IF NOT EXISTS idx_training_load_user_date  ON training_load(user_id, calendar_date DESC);
CREATE INDEX IF NOT EXISTS idx_deload_history_user      ON deload_history(user_id, start_date DESC);
