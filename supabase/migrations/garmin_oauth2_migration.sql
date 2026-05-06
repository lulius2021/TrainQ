-- Garmin OAuth2 PKCE Migration
-- Migrates from OAuth 1.0a to OAuth2 PKCE schema.
-- Run this AFTER garmin_integration.sql has been applied.

-- 1. Update garmin_oauth_temp for PKCE (replace request_token fields with state + code_verifier)
ALTER TABLE garmin_oauth_temp
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS code_verifier TEXT;

-- Drop old OAuth 1.0a columns (if they exist)
ALTER TABLE garmin_oauth_temp
  DROP COLUMN IF EXISTS request_token,
  DROP COLUMN IF EXISTS request_token_secret;

-- Index on state for callback lookup
CREATE INDEX IF NOT EXISTS idx_got_state ON garmin_oauth_temp(state);

-- Drop old index on request_token if it exists
DROP INDEX IF EXISTS idx_got_token;

-- 2. Update garmin_tokens for OAuth2 (add refresh_token + token_expiry, remove token_secret)
ALTER TABLE garmin_tokens
  ADD COLUMN IF NOT EXISTS refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMPTZ;

-- Drop old OAuth 1.0a column
ALTER TABLE garmin_tokens
  DROP COLUMN IF EXISTS token_secret;

-- 3. Add headers column to garmin_raw_events for request verification audit
ALTER TABLE garmin_raw_events
  ADD COLUMN IF NOT EXISTS request_headers JSONB;
