-- MAIN project only: install capture prerequisites, without moving CRM records.
BEGIN;
SET LOCAL lock_timeout='10s';
-- DRAFT / LOCAL REHEARSAL ONLY. Do not execute in Supabase yet.
-- Intended location: main database, outside the four frozen CRM tables.
-- Stores restricted PII. Never log payloads; define purge after accepted replay.
-- Replay must apply database effects AND completion in ONE transaction on this DB.
-- Separate HTTP requests to select/apply/complete are NOT a safe replay worker.

CREATE TABLE public.odeon_crm_cutover_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  kind text NOT NULL CHECK (kind IN ('intake', 'inbound_sms', 'voice_status')),
  delivery_key text NOT NULL CHECK (length(delivery_key) BETWEEN 1 AND 200),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, kind, delivery_key)
);
CREATE INDEX odeon_crm_cutover_queue_pending
  ON public.odeon_crm_cutover_queue (received_at, id)
  WHERE completed_at IS NULL;
ALTER TABLE public.odeon_crm_cutover_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.odeon_crm_cutover_queue FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.odeon_crm_cutover_queue TO service_role;

CREATE FUNCTION public.odeon_crm_capture(
  p_tenant_id uuid, p_kind text, p_delivery_key text, p_payload jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE saved public.odeon_crm_cutover_queue;
BEGIN
  INSERT INTO public.odeon_crm_cutover_queue(tenant_id, kind, delivery_key, payload)
    VALUES (p_tenant_id, p_kind, p_delivery_key, p_payload)
    ON CONFLICT (tenant_id, kind, delivery_key) DO NOTHING
    RETURNING * INTO saved;
  IF saved.id IS NULL THEN
    SELECT * INTO saved FROM public.odeon_crm_cutover_queue
      WHERE tenant_id=p_tenant_id AND kind=p_kind AND delivery_key=p_delivery_key;
    IF saved.id IS NULL OR saved.payload IS DISTINCT FROM p_payload THEN
      RAISE EXCEPTION 'Capture key conflict; reconciliation required';
    END IF;
  END IF;
  RETURN saved.id;
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_crm_capture(uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_capture(uuid, text, text, jsonb)
  TO service_role;

-- DRAFT / LOCAL ONLY. Run only after signature-validated durable capture.
-- Separate from CRM projection: main message/consent writes can continue during CRM freeze.

ALTER TABLE public.odeon_crm_cutover_queue ADD COLUMN message_persisted_at timestamptz;
CREATE FUNCTION public.odeon_crm_persist_captured_sms(p_queue_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  q public.odeon_crm_cutover_queue;
  sender text;
  recipient text;
  sid text;
  body_value text;
  digits text;
  matches uuid[];
  person uuid;
  previous record;
  campaign uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(8675311);
  SELECT * INTO q FROM public.odeon_crm_cutover_queue WHERE id=p_queue_id FOR UPDATE;
  IF NOT FOUND OR q.kind<>'inbound_sms' THEN RAISE EXCEPTION 'SMS capture missing'; END IF;
  sender:=q.payload->>'from_phone'; recipient:=q.payload->>'to_phone';
  sid:=q.payload->>'message_sid'; body_value:=q.payload->>'body';
  IF sender IS NULL OR sender !~ '^\+[1-9][0-9]{6,14}$'
    OR recipient IS NULL OR recipient !~ '^\+[1-9][0-9]{6,14}$'
    OR sid IS NULL OR sid !~ '^SM[0-9a-fA-F]{32}$'
    OR sid IS DISTINCT FROM q.delivery_key
    OR jsonb_typeof(q.payload->'body') IS DISTINCT FROM 'string'
    OR (q.payload ? 'tenant_id' AND q.payload->>'tenant_id' IS DISTINCT FROM q.tenant_id::text)
  THEN RAISE EXCEPTION 'Invalid captured SMS'; END IF;
  IF q.message_persisted_at IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.messages WHERE id=q.id AND tenant_id=q.tenant_id
      AND twilio_sid=sid AND direction='inbound' AND body IS NOT DISTINCT FROM body_value
      AND from_phone=sender AND to_phone=recipient)
    THEN RAISE EXCEPTION 'Persisted SMS mismatch'; END IF;
    RETURN q.id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.odeon_crm_cutover_queue
    WHERE kind='inbound_sms' AND message_persisted_at IS NULL
      AND (received_at,id)<(q.received_at,q.id))
  THEN RAISE EXCEPTION 'Earlier SMS pending'; END IF;
  IF EXISTS (SELECT 1 FROM public.messages WHERE tenant_id=q.tenant_id AND twilio_sid=sid)
  THEN RAISE EXCEPTION 'Existing message requires reconciliation'; END IF;
  digits:=regexp_replace(sender,'[^0-9]','','g');
  IF length(digits)=11 AND left(digits,1)='1' THEN digits:=substr(digits,2); END IF;
  SELECT contact_id,campaign_id INTO previous FROM public.messages
    WHERE tenant_id=q.tenant_id AND direction='outbound' AND to_phone IN (sender,digits)
      AND created_at<=q.received_at
    ORDER BY created_at DESC,id DESC LIMIT 1;
  person:=previous.contact_id;
  campaign:=previous.campaign_id;
  IF person IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.people
    WHERE id=person AND tenant_id=q.tenant_id)
  THEN RAISE EXCEPTION 'Outbound SMS person tenant mismatch'; END IF;
  IF campaign IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.campaigns
    WHERE id=campaign AND tenant_id=q.tenant_id)
  THEN RAISE EXCEPTION 'Outbound SMS campaign tenant mismatch'; END IF;
  IF person IS NULL THEN
    SELECT array_agg(id) INTO matches FROM public.people
      WHERE tenant_id=q.tenant_id AND phone IN (sender,digits);
    IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Ambiguous SMS person'; END IF;
    person:=matches[1];
  END IF;
  INSERT INTO public.messages(id,tenant_id,contact_id,campaign_id,channel,direction,body,status,
    twilio_sid,created_at,from_phone,to_phone)
  VALUES(q.id,q.tenant_id,person,campaign,'sms','inbound',body_value,'received',sid,q.received_at,sender,recipient);
  IF person IS NOT NULL AND upper(btrim(body_value)) IN ('STOP','START') THEN
    UPDATE public.people SET opted_out=(upper(btrim(body_value))='STOP')
      WHERE id=person AND tenant_id=q.tenant_id;
  END IF;
  UPDATE public.odeon_crm_cutover_queue SET message_persisted_at=now() WHERE id=q.id;
  RETURN q.id;
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_crm_persist_captured_sms(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_persist_captured_sms(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
