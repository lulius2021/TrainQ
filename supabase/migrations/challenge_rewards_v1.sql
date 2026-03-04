-- Challenge-Reward System: Monthly Challenges with Pro Grants
-- Phase 1: Server-Tabellen + lokaler Pro-Grant

-- ============================================================
-- 1. monthly_challenges — Admin-verwaltete Challenge-Definitionen
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_de TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_de TEXT NOT NULL,
  description_en TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🏆',
  goal_type TEXT NOT NULL CHECK (goal_type IN ('workout_count', 'distance_km', 'volume_kg')),
  goal_target NUMERIC NOT NULL CHECK (goal_target > 0),
  goal_sport_filter TEXT, -- NULL = alle Sportarten
  duration_days INT NOT NULL CHECK (duration_days > 0),
  reward_type TEXT CHECK (reward_type IN ('pro_days') OR reward_type IS NULL),
  reward_days INT CHECK (reward_days > 0 OR reward_days IS NULL),
  active_from DATE NOT NULL,
  active_until DATE NOT NULL,
  max_winners INT NOT NULL DEFAULT 100,
  current_winners INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (active_until >= active_from)
);

-- RLS: Jeder kann aktive Challenges lesen, nur Service-Role schreibt
ALTER TABLE monthly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active challenges"
  ON monthly_challenges FOR SELECT
  USING (is_active = true);

-- ============================================================
-- 2. challenge_participations — User-Teilnahmen
-- ============================================================
CREATE TABLE IF NOT EXISTS challenge_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES monthly_challenges(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  progress_current NUMERIC NOT NULL DEFAULT 0,
  progress_target NUMERIC NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  reward_eligible BOOLEAN NOT NULL DEFAULT false,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  reward_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

-- RLS: User liest nur eigene
ALTER TABLE challenge_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own participations"
  ON challenge_participations FOR SELECT
  USING (auth.uid() = user_id);

-- Insert/Update nur via DB-Funktionen (SECURITY DEFINER)

-- ============================================================
-- 3. challenge_pro_grants — Server-Record der Pro-Grants
-- ============================================================
CREATE TABLE IF NOT EXISTS challenge_pro_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participation_id UUID NOT NULL UNIQUE REFERENCES challenge_participations(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  source_challenge_id UUID NOT NULL REFERENCES monthly_challenges(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: User liest nur eigene
ALTER TABLE challenge_pro_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pro grants"
  ON challenge_pro_grants FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_challenge_participations_user ON challenge_participations(user_id);
CREATE INDEX idx_challenge_participations_challenge ON challenge_participations(challenge_id);
CREATE INDEX idx_challenge_pro_grants_user ON challenge_pro_grants(user_id);
CREATE INDEX idx_challenge_pro_grants_active ON challenge_pro_grants(user_id, is_active) WHERE is_active = true;

-- ============================================================
-- DB Function 1: join_challenge
-- Atomar prüft alle Bedingungen und erstellt Teilnahme
-- ============================================================
CREATE OR REPLACE FUNCTION join_challenge(p_user_id UUID, p_challenge_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge monthly_challenges%ROWTYPE;
  v_existing UUID;
  v_active_reward UUID;
  v_recent_claim TIMESTAMPTZ;
  v_participation_id UUID;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- 1. Challenge existiert + aktiv + im Zeitfenster
  SELECT * INTO v_challenge
  FROM monthly_challenges
  WHERE id = p_challenge_id
    AND is_active = true
    AND CURRENT_DATE >= active_from
    AND CURRENT_DATE <= active_until
  FOR UPDATE;

  IF v_challenge IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'challenge_not_found');
  END IF;

  -- 2. User nicht schon beigetreten
  SELECT id INTO v_existing
  FROM challenge_participations
  WHERE user_id = p_user_id AND challenge_id = p_challenge_id;

  IF v_existing IS NOT NULL THEN
    RETURN json_build_object('ok', false, 'error', 'already_joined');
  END IF;

  -- 3. Max 1 aktive Reward-Challenge gleichzeitig
  IF v_challenge.reward_type IS NOT NULL THEN
    SELECT cp.id INTO v_active_reward
    FROM challenge_participations cp
    JOIN monthly_challenges mc ON mc.id = cp.challenge_id
    WHERE cp.user_id = p_user_id
      AND cp.completed = false
      AND cp.end_date >= CURRENT_DATE
      AND mc.reward_type IS NOT NULL
    LIMIT 1;

    IF v_active_reward IS NOT NULL THEN
      RETURN json_build_object('ok', false, 'error', 'active_reward_challenge');
    END IF;

    -- 4. Max 1 Reward/Monat (claimed check)
    SELECT cpg.granted_at INTO v_recent_claim
    FROM challenge_pro_grants cpg
    WHERE cpg.user_id = p_user_id
      AND cpg.granted_at >= date_trunc('month', CURRENT_DATE)
    LIMIT 1;

    IF v_recent_claim IS NOT NULL THEN
      RETURN json_build_object('ok', false, 'error', 'monthly_limit');
    END IF;
  END IF;

  -- 5. Winner-Cap nicht erreicht
  IF v_challenge.reward_type IS NOT NULL AND v_challenge.current_winners >= v_challenge.max_winners THEN
    RETURN json_build_object('ok', false, 'error', 'winner_cap_reached');
  END IF;

  -- 6. Insert
  v_start_date := CURRENT_DATE;
  v_end_date := CURRENT_DATE + v_challenge.duration_days;

  INSERT INTO challenge_participations (
    user_id, challenge_id, start_date, end_date,
    progress_current, progress_target,
    reward_eligible
  ) VALUES (
    p_user_id, p_challenge_id, v_start_date, v_end_date,
    0, v_challenge.goal_target,
    v_challenge.reward_type IS NOT NULL
  )
  RETURNING id INTO v_participation_id;

  RETURN json_build_object('ok', true, 'participation_id', v_participation_id);
END;
$$;

-- ============================================================
-- DB Function 2: submit_challenge_progress
-- Updates progress, marks completed when target reached
-- ============================================================
CREATE OR REPLACE FUNCTION submit_challenge_progress(p_user_id UUID, p_participation_id UUID, p_progress NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part challenge_participations%ROWTYPE;
  v_completed BOOLEAN := false;
BEGIN
  -- Find participation
  SELECT * INTO v_part
  FROM challenge_participations
  WHERE id = p_participation_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_part IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'participation_not_found');
  END IF;

  IF v_part.completed THEN
    RETURN json_build_object('ok', true, 'completed', true);
  END IF;

  -- Update progress
  v_completed := p_progress >= v_part.progress_target;

  UPDATE challenge_participations
  SET progress_current = p_progress,
      completed = v_completed,
      completed_at = CASE WHEN v_completed THEN now() ELSE NULL END,
      reward_expires_at = CASE WHEN v_completed AND reward_eligible THEN now() + interval '60 days' ELSE NULL END
  WHERE id = p_participation_id;

  RETURN json_build_object('ok', true, 'completed', v_completed);
END;
$$;

-- ============================================================
-- DB Function 3: claim_challenge_reward
-- Atomar prüft alle Bedingungen und erstellt Pro-Grant
-- ============================================================
CREATE OR REPLACE FUNCTION claim_challenge_reward(p_user_id UUID, p_participation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part challenge_participations%ROWTYPE;
  v_challenge monthly_challenges%ROWTYPE;
  v_is_pro BOOLEAN;
  v_grant_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- 1. Find participation
  SELECT * INTO v_part
  FROM challenge_participations
  WHERE id = p_participation_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_part IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'participation_not_found');
  END IF;

  -- 2. Check completed + eligible + not claimed
  IF NOT v_part.completed THEN
    RETURN json_build_object('ok', false, 'error', 'not_completed');
  END IF;

  IF NOT v_part.reward_eligible THEN
    RETURN json_build_object('ok', false, 'error', 'not_eligible');
  END IF;

  IF v_part.reward_claimed THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  -- 3. Check not expired
  IF v_part.reward_expires_at IS NOT NULL AND v_part.reward_expires_at < now() THEN
    RETURN json_build_object('ok', false, 'error', 'reward_expired');
  END IF;

  -- 4. Check user not already Pro (subscription) → kein Stacking
  SELECT COALESCE(
    (raw_user_meta_data->>'plan') = 'pro',
    false
  ) INTO v_is_pro
  FROM auth.users
  WHERE id = p_user_id;

  IF v_is_pro THEN
    RETURN json_build_object('ok', false, 'error', 'already_pro');
  END IF;

  -- 5. Get challenge details for reward_days
  SELECT * INTO v_challenge
  FROM monthly_challenges
  WHERE id = v_part.challenge_id;

  IF v_challenge IS NULL OR v_challenge.reward_days IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'no_reward');
  END IF;

  -- 6. Mark claimed
  v_expires_at := now() + (v_challenge.reward_days || ' days')::interval;

  UPDATE challenge_participations
  SET reward_claimed = true
  WHERE id = p_participation_id;

  -- 7. Increment winner count
  UPDATE monthly_challenges
  SET current_winners = current_winners + 1
  WHERE id = v_part.challenge_id;

  -- 8. Create pro grant
  INSERT INTO challenge_pro_grants (
    user_id, participation_id, expires_at, source_challenge_id
  ) VALUES (
    p_user_id, p_participation_id, v_expires_at, v_part.challenge_id
  )
  RETURNING id INTO v_grant_id;

  RETURN json_build_object(
    'ok', true,
    'grant_id', v_grant_id,
    'expires_at', v_expires_at
  );
END;
$$;
