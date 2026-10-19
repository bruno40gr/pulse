-- Apply after 12-gmail-outreach.sql to the consolidated database, following release review.
-- Existing read-only connections remain readable but must reconnect before sending.
BEGIN;
ALTER TABLE public.gmail_connections ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT ARRAY['https://www.googleapis.com/auth/gmail.readonly'];
COMMIT;