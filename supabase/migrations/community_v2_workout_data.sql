-- community_v2_workout_data.sql
-- Adds workout_data JSONB column to community_posts for rich workout display.
-- Apply AFTER community_v1.sql.

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS workout_data JSONB DEFAULT NULL;

COMMENT ON COLUMN community_posts.workout_data IS 'Structured workout stats (title, sport, duration, volume, sets, exercises, muscle groups) for workout_share posts';
