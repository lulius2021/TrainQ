-- ============================================================
-- TrainQ Combined Setup Migration
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor)
-- All statements use IF NOT EXISTS / OR REPLACE — safe to re-run
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. GARMIN TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS garmin_oauth_temp (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes')
);

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

-- RLS for Garmin tables
ALTER TABLE garmin_oauth_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_sleep_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE garmin_activities ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'garmin_tokens' AND policyname = 'Users own tokens') THEN
    CREATE POLICY "Users own tokens" ON garmin_tokens FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'garmin_daily_metrics' AND policyname = 'Users own metrics') THEN
    CREATE POLICY "Users own metrics" ON garmin_daily_metrics FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'garmin_sleep_summaries' AND policyname = 'Users own sleep') THEN
    CREATE POLICY "Users own sleep" ON garmin_sleep_summaries FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'garmin_activities' AND policyname = 'Users own activities') THEN
    CREATE POLICY "Users own activities" ON garmin_activities FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. COMMUNITY TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS community_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT DEFAULT '' CHECK (char_length(bio) <= 500),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  ban_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_handle ON community_profiles(lower(handle));
ALTER TABLE community_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_profiles' AND policyname = 'Anyone can read profiles') THEN
    CREATE POLICY "Anyone can read profiles" ON community_profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_profiles' AND policyname = 'Users update own profile') THEN
    CREATE POLICY "Users update own profile" ON community_profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_profiles' AND policyname = 'Users insert own profile') THEN
    CREATE POLICY "Users insert own profile" ON community_profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_cf_following ON community_follows(following_id);
ALTER TABLE community_follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_follows' AND policyname = 'Anyone can read follows') THEN
    CREATE POLICY "Anyone can read follows" ON community_follows FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_follows' AND policyname = 'Users manage own follows') THEN
    CREATE POLICY "Users manage own follows" ON community_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_follows' AND policyname = 'Users delete own follows') THEN
    CREATE POLICY "Users delete own follows" ON community_follows FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_cb_blocked ON community_blocks(blocked_id);
ALTER TABLE community_blocks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_blocks' AND policyname = 'Users read own blocks') THEN
    CREATE POLICY "Users read own blocks" ON community_blocks FOR SELECT USING (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_blocks' AND policyname = 'Users insert blocks') THEN
    CREATE POLICY "Users insert blocks" ON community_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_blocks' AND policyname = 'Users delete own blocks') THEN
    CREATE POLICY "Users delete own blocks" ON community_blocks FOR DELETE USING (auth.uid() = blocker_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_post_type') THEN
    CREATE TYPE community_post_type AS ENUM ('workout_share', 'text_post', 'progress_update');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_visibility') THEN
    CREATE TYPE community_visibility AS ENUM ('public', 'followers', 'private');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type community_post_type NOT NULL DEFAULT 'text_post',
  text TEXT CHECK (char_length(text) <= 1000),
  card_image_url TEXT,
  workout_ref_id TEXT,
  workout_data JSONB DEFAULT NULL,
  garmin_data JSONB DEFAULT NULL,
  visibility community_visibility NOT NULL DEFAULT 'followers',
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  is_removed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON community_posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON community_posts(visibility, created_at DESC) WHERE NOT is_removed;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION community_can_view_post(viewer_id UUID, post_row community_posts)
RETURNS BOOLEAN AS $$
BEGIN
  IF viewer_id = post_row.author_id THEN RETURN true; END IF;
  IF post_row.is_removed THEN RETURN false; END IF;
  IF EXISTS (
    SELECT 1 FROM community_blocks
    WHERE (blocker_id = viewer_id AND blocked_id = post_row.author_id)
       OR (blocker_id = post_row.author_id AND blocked_id = viewer_id)
  ) THEN RETURN false; END IF;
  IF post_row.visibility = 'public' THEN RETURN true; END IF;
  IF post_row.visibility = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM community_follows
      WHERE follower_id = viewer_id AND following_id = post_row.author_id
    );
  END IF;
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_posts' AND policyname = 'Post visibility') THEN
    CREATE POLICY "Post visibility" ON community_posts FOR SELECT USING (community_can_view_post(auth.uid(), community_posts));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_posts' AND policyname = 'Authors insert posts') THEN
    CREATE POLICY "Authors insert posts" ON community_posts FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_posts' AND policyname = 'Authors delete own posts') THEN
    CREATE POLICY "Authors delete own posts" ON community_posts FOR DELETE USING (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_posts' AND policyname = 'Authors update own posts') THEN
    CREATE POLICY "Authors update own posts" ON community_posts FOR UPDATE USING (auth.uid() = author_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_post_likes (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_post_likes' AND policyname = 'Users read likes on visible posts') THEN
    CREATE POLICY "Users read likes on visible posts" ON community_post_likes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_post_likes' AND policyname = 'Users insert own likes') THEN
    CREATE POLICY "Users insert own likes" ON community_post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_post_likes' AND policyname = 'Users delete own likes') THEN
    CREATE POLICY "Users delete own likes" ON community_post_likes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON community_comments(post_id, created_at);
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_comments' AND policyname = 'Users read comments') THEN
    CREATE POLICY "Users read comments" ON community_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_comments' AND policyname = 'Users insert comments') THEN
    CREATE POLICY "Users insert comments" ON community_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_comments' AND policyname = 'Authors soft-delete comments') THEN
    CREATE POLICY "Authors soft-delete comments" ON community_comments FOR UPDATE USING (auth.uid() = author_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'community_notification_type') THEN
    CREATE TYPE community_notification_type AS ENUM ('like', 'comment', 'follow');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS community_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type community_notification_type NOT NULL,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON community_notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON community_notifications(user_id, read_at) WHERE read_at IS NULL;
ALTER TABLE community_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_notifications' AND policyname = 'Users read own notifications') THEN
    CREATE POLICY "Users read own notifications" ON community_notifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_notifications' AND policyname = 'Users mark own as read') THEN
    CREATE POLICY "Users mark own as read" ON community_notifications FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── Triggers: like/comment counts ──

CREATE OR REPLACE FUNCTION update_post_like_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_like_count ON community_post_likes;
CREATE TRIGGER trg_post_like_count
  AFTER INSERT OR DELETE ON community_post_likes
  FOR EACH ROW EXECUTE FUNCTION update_post_like_count();

CREATE OR REPLACE FUNCTION update_post_comment_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_comment_count ON community_comments;
CREATE TRIGGER trg_post_comment_count
  AFTER INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- ── Triggers: notifications ──

CREATE OR REPLACE FUNCTION notify_on_like() RETURNS TRIGGER AS $$
DECLARE post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM community_posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
    INSERT INTO community_notifications (user_id, type, actor_id, post_id)
    VALUES (post_author, 'like', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_like ON community_post_likes;
CREATE TRIGGER trg_notify_like
  AFTER INSERT ON community_post_likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS TRIGGER AS $$
DECLARE post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM community_posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.author_id THEN
    INSERT INTO community_notifications (user_id, type, actor_id, post_id, comment_id)
    VALUES (post_author, 'comment', NEW.author_id, NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_comment ON community_comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

CREATE OR REPLACE FUNCTION notify_on_follow() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community_notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'follow', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_follow ON community_follows;
CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON community_follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();
