-- Supports the sidebar's tenant-scoped, paginated unread-only scan.
CREATE INDEX IF NOT EXISTS idx_messages_tenant_unread_inbound
  ON public.messages (tenant_id, id) INCLUDE (from_phone, campaign_id)
  WHERE direction = 'inbound' AND (status IS NULL OR status <> 'read');