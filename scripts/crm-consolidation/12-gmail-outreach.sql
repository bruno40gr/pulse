-- Apply to consolidated Odeon staging first, then Odeon production after acceptance/backup.
-- Legacy CRM_SUPABASE_* settings must target the same project as the primary client.
-- Do not apply to the frozen former CRM project. Check existing objects before running.
-- Mailbox tokens are encrypted by the server. All access is service-role only.
BEGIN;
CREATE TABLE public.gmail_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  email text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  connected_by uuid NOT NULL,
  capture_from timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  sync_until timestamptz,
  page_token text,
  lease_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE TABLE public.gmail_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  connection_id uuid REFERENCES public.gmail_connections(id) ON DELETE SET NULL,
  fingerprint text NOT NULL,
  provider_message_id text NOT NULL,
  sender text NOT NULL,
  recipients text[] NOT NULL,
  subject text NOT NULL,
  body text NOT NULL CHECK (length(body) <= 12000),
  sent_at timestamptz NOT NULL,
  candidate_lead_ids uuid[] NOT NULL,
  lead_id uuid REFERENCES public.lead_intakes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'recorded', 'ignored')),
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, fingerprint)
);
CREATE INDEX gmail_outreach_review ON public.gmail_outreach(tenant_id, status, sent_at DESC);
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_outreach ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gmail_connections, public.gmail_outreach FROM anon, authenticated;
GRANT ALL ON public.gmail_connections, public.gmail_outreach TO service_role;

CREATE FUNCTION public.gmail_claim_sync(p_id uuid, p_tenant uuid)
RETURNS SETOF public.gmail_connections LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE gmail_connections SET lease_until = now() + interval '5 minutes',
    sync_until = COALESCE(sync_until, now())
  WHERE id = p_id AND tenant_id = p_tenant AND (lease_until IS NULL OR lease_until < now())
  RETURNING *;
$$;

-- Note, dedup receipt and any guarded status change commit together.
CREATE FUNCTION public.gmail_record_outreach(p_tenant uuid, p_message uuid, p_lead uuid, p_note text, p_decision text, p_actor uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m gmail_outreach%ROWTYPE; l lead_intakes%ROWTYPE; change jsonb; change_id uuid;
BEGIN
  SELECT * INTO m FROM gmail_outreach WHERE id = p_message AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Message not found' USING ERRCODE = '22023'; END IF;
  IF m.status = 'recorded' THEN RETURN m.event_id; END IF;
  IF m.status <> 'review' OR NOT p_lead = ANY(m.candidate_lead_ids) THEN
    RAISE EXCEPTION 'Choose a candidate lead' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO l FROM lead_intakes WHERE id = p_lead AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found' USING ERRCODE = '22023'; END IF;
  INSERT INTO lead_events(id, tenant_id, lead_intake_id, contact_id, event_type, event_label, payload, created_at)
  VALUES(m.event_id, p_tenant, l.id, l.contact_id, 'note_added', 'Email sent',
    jsonb_build_object('text', p_note, 'actor', jsonb_build_object('displayName', 'Email sync', 'membershipId', p_actor),
      'source', 'gmail', 'sender', m.sender, 'recipients', m.recipients, 'subject', m.subject, 'provider_message_id', m.provider_message_id), m.sent_at);
  IF p_decision IN ('contacted', 'booked') AND (l.status = 'new' OR (l.status = 'contacted' AND p_decision = 'booked'))
    AND l.intake_type IN ('lesson_inquiry','tour_request','service_inquiry')
    AND l.source_form <> '2026-disenrollment-import' AND NOT COALESCE(l.payload ? 'winback', false)
    AND COALESCE(l.payload->'status_automation'->>'paused','false') <> 'true'
    AND COALESCE((NULLIF(l.payload->'status_automation'->'last_change'->>'changed_at',''))::timestamptz, '-infinity'::timestamptz) <= m.sent_at THEN
    change_id := gen_random_uuid();
    change := jsonb_build_object('id', change_id, 'previous_status', l.status, 'next_status', p_decision,
      'reason', CASE WHEN p_decision = 'booked' THEN 'Explicit booking confirmation captured from sent email' ELSE 'Sent email outreach captured' END,
      'evidence', left(m.body, 1000), 'note_event_id', m.event_id, 'changed_at', now());
    UPDATE lead_intakes SET status = p_decision, updated_at = now(),
      payload = jsonb_set(COALESCE(payload, '{}'::jsonb), '{status_automation}', jsonb_build_object('paused',false,'last_change',change))
    WHERE id = l.id AND tenant_id = p_tenant;
    INSERT INTO lead_events(tenant_id, lead_intake_id, contact_id, event_type, event_label, payload)
    VALUES(p_tenant, l.id, l.contact_id, 'status_automated', 'Email outreach status update', change || jsonb_build_object('source','gmail'));
  END IF;
  UPDATE gmail_outreach SET status = 'recorded', lead_id = l.id, resolved_by = p_actor WHERE id = m.id;
  RETURN m.event_id;
END;
$$;
REVOKE ALL ON FUNCTION public.gmail_claim_sync(uuid,uuid), public.gmail_record_outreach(uuid,uuid,uuid,text,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gmail_claim_sync(uuid,uuid), public.gmail_record_outreach(uuid,uuid,uuid,text,text,uuid) TO service_role;
COMMIT;