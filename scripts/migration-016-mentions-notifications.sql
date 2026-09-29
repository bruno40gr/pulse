-- Migration 016: membership-backed mentions, notifications,
-- and message delivery lookup indexes.

BEGIN;

CREATE TABLE IF NOT EXISTS public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mentioned_membership_id UUID NOT NULL REFERENCES public.tenant_memberships(id) ON DELETE CASCADE,
  actor_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('dashboard_note', 'note_reply', 'lead_note', 'contact_internal_note')),
  entity_id TEXT NOT NULL,
  parent_entity_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, mentioned_membership_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_mentions_recipient_created
  ON public.mentions (tenant_id, mentioned_membership_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_membership_id UUID NOT NULL REFERENCES public.tenant_memberships(id) ON DELETE CASCADE,
  actor_membership_id UUID REFERENCES public.tenant_memberships(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('mention.created', 'note.reply')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT NOT NULL,
  deduplication_key TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, recipient_membership_id, deduplication_key)
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (tenant_id, recipient_membership_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications (tenant_id, recipient_membership_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_tenant_twilio_sid
  ON public.messages (tenant_id, twilio_sid)
  WHERE twilio_sid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_tenant_contact_created
  ON public.messages (tenant_id, contact_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;

COMMIT;