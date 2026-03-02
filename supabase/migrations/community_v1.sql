-- ============================================================
-- TrainQ Community Module — V1 Schema
-- Tables: community_profiles, follows, blocks, posts, post_likes,
--         comments, reports, moderation_actions, notifications
-- ============================================================

-- 1. Community Profiles (extends auth.users)
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

CREATE POLICY "Anyone can read profiles" ON community_profiles
  FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON community_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON community_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Follows (unidirectional)
CREATE TABLE IF NOT EXISTS community_follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_cf_following ON community_follows(following_id);
ALTER TABLE community_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read follows" ON community_follows
  FOR SELECT USING (true);
CREATE POLICY "Users manage own follows" ON community_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users delete own follows" ON community_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- 3. Blocks (bidirectional effect)
CREATE TABLE IF NOT EXISTS community_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_cb_blocked ON community_blocks(blocked_id);
ALTER TABLE community_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own blocks" ON community_blocks
  FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users insert blocks" ON community_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users delete own blocks" ON community_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- 4. Posts
CREATE TYPE community_post_type AS ENUM ('workout_share', 'text_post', 'progress_update');
CREATE TYPE community_visibility AS ENUM ('public', 'followers', 'private');

CREATE TABLE IF NOT EXISTS community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type community_post_type NOT NULL DEFAULT 'text_post',
  text TEXT CHECK (char_length(text) <= 1000),
  card_image_url TEXT,
  workout_ref_id TEXT,
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

-- Posts: complex visibility via function
CREATE OR REPLACE FUNCTION community_can_view_post(viewer_id UUID, post_row community_posts)
RETURNS BOOLEAN AS $$
BEGIN
  -- Author can always see own posts
  IF viewer_id = post_row.author_id THEN RETURN true; END IF;
  -- Removed posts hidden from non-authors
  IF post_row.is_removed THEN RETURN false; END IF;
  -- Check blocks (either direction)
  IF EXISTS (
    SELECT 1 FROM community_blocks
    WHERE (blocker_id = viewer_id AND blocked_id = post_row.author_id)
       OR (blocker_id = post_row.author_id AND blocked_id = viewer_id)
  ) THEN RETURN false; END IF;
  -- Public: anyone
  IF post_row.visibility = 'public' THEN RETURN true; END IF;
  -- Followers: only if viewer follows author
  IF post_row.visibility = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM community_follows
      WHERE follower_id = viewer_id AND following_id = post_row.author_id
    );
  END IF;
  -- Private: only author (handled above)
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE POLICY "Post visibility" ON community_posts
  FOR SELECT USING (community_can_view_post(auth.uid(), community_posts));
CREATE POLICY "Authors insert posts" ON community_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors delete own posts" ON community_posts
  FOR DELETE USING (auth.uid() = author_id);
CREATE POLICY "Authors update own posts" ON community_posts
  FOR UPDATE USING (auth.uid() = author_id);

-- 5. Post Likes
CREATE TABLE IF NOT EXISTS community_post_likes (
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE community_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read likes on visible posts" ON community_post_likes
  FOR SELECT USING (true);
CREATE POLICY "Users insert own likes" ON community_post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own likes" ON community_post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Comments
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

CREATE POLICY "Users read comments" ON community_comments
  FOR SELECT USING (true);
CREATE POLICY "Users insert comments" ON community_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors soft-delete comments" ON community_comments
  FOR UPDATE USING (auth.uid() = author_id);

-- 7. Reports
CREATE TYPE community_report_reason AS ENUM ('spam', 'harassment', 'hate', 'nudity', 'self_harm', 'other');
CREATE TYPE community_report_target AS ENUM ('post', 'comment', 'user');
CREATE TYPE community_report_status AS ENUM ('open', 'closed');

CREATE TABLE IF NOT EXISTS community_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type community_report_target NOT NULL,
  target_id UUID NOT NULL,
  reason community_report_reason NOT NULL,
  details TEXT CHECK (char_length(details) <= 1000),
  status community_report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolver_id UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON community_reports(status, created_at DESC);
ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert reports" ON community_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- 8. Moderation Actions (admin-only via service role)
CREATE TYPE community_mod_action AS ENUM ('remove_content', 'warn_user', 'temp_ban', 'perm_ban', 'close_report');

CREATE TABLE IF NOT EXISTS community_moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES auth.users(id),
  action_type community_mod_action NOT NULL,
  target_user_id UUID REFERENCES auth.users(id),
  target_content_id UUID,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE community_moderation_actions ENABLE ROW LEVEL SECURITY;
-- Service role only — no user-facing policies

-- 9. Notifications (in-app)
CREATE TYPE community_notification_type AS ENUM ('like', 'comment', 'follow');

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

CREATE POLICY "Users read own notifications" ON community_notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users mark own as read" ON community_notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- Helper: update like/comment counts via triggers
-- ============================================================

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

CREATE TRIGGER trg_post_comment_count
  AFTER INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- ============================================================
-- Helper: auto-create notification on like/comment/follow
-- ============================================================

CREATE OR REPLACE FUNCTION notify_on_like() RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM community_posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
    INSERT INTO community_notifications (user_id, type, actor_id, post_id)
    VALUES (post_author, 'like', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_like
  AFTER INSERT ON community_post_likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

CREATE OR REPLACE FUNCTION notify_on_comment() RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM community_posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.author_id THEN
    INSERT INTO community_notifications (user_id, type, actor_id, post_id, comment_id)
    VALUES (post_author, 'comment', NEW.author_id, NEW.post_id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

CREATE TRIGGER trg_notify_follow
  AFTER INSERT ON community_follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();
