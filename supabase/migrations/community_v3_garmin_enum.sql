-- Add garmin_activity to community_post_type enum
-- Run AFTER community_v1.sql
ALTER TYPE community_post_type ADD VALUE IF NOT EXISTS 'garmin_activity';
