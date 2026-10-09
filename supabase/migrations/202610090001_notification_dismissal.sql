BEGIN;

-- read_at records interaction (seen). Dismissal is independent.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS notifications_pending_recipient_idx
  ON public.notifications (tenant_id, recipient_membership_id, created_at DESC)
  WHERE dismissed_at IS NULL;

NOTIFY pgrst, 'reload schema';
COMMIT;