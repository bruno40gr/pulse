-- Run in the CRM database (gmail_connections lives here). No existing mailbox is
-- implicitly promoted: the account owner must explicitly select the shared account.
CREATE TABLE IF NOT EXISTS organisation_email_settings (
  tenant_id UUID PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES gmail_connections(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  signature_text TEXT NOT NULL DEFAULT '',
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(aliases) = 'array'),
  configured_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS organisation_email_deliveries (
  tenant_id UUID NOT NULL,
  operation_id UUID NOT NULL,
  destination TEXT NOT NULL,
  actor_membership_id UUID NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed', 'unknown')),
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, operation_id, destination)
);
ALTER TABLE organisation_email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organisation_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON organisation_email_settings, organisation_email_deliveries FROM anon, authenticated;
GRANT ALL ON organisation_email_settings, organisation_email_deliveries TO service_role;