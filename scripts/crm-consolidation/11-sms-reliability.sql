-- Main database only. Review and rehearse before production installation.
BEGIN;
SET LOCAL lock_timeout = '10s';
CREATE TABLE public.sms_deleted_receipts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  twilio_sid text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, twilio_sid)
);
CREATE TABLE public.sms_reconciliation_state (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  recovered_count integer NOT NULL DEFAULT 0
);
INSERT INTO public.sms_reconciliation_state(tenant_id)
  SELECT DISTINCT tenant_id FROM public.twilio_config;
ALTER TABLE public.sms_deleted_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_reconciliation_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sms_deleted_receipts, public.sms_reconciliation_state FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.sms_reconciliation_state TO service_role;
GRANT SELECT ON public.sms_deleted_receipts TO service_role;

-- Atomic with DELETE, including deletes performed outside the Inbox route.
-- Store identifiers only, not deleted message content.
CREATE FUNCTION public.sms_remember_deletion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.direction='inbound' AND OLD.twilio_sid IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(8675311);
    INSERT INTO public.sms_deleted_receipts(tenant_id,twilio_sid)
      VALUES(OLD.tenant_id,OLD.twilio_sid) ON CONFLICT DO NOTHING;
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.sms_remember_deletion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sms_remember_deletion BEFORE DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.sms_remember_deletion();

-- Both webhook delivery and provider reconciliation use this atomic receipt path.
-- CRM projection remains pending in the migration queue; it cannot prevent inbox storage.
CREATE FUNCTION public.odeon_sms_receive(
  p_tenant_id uuid, p_payload jsonb, p_received_at timestamptz DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE
  sid text:=p_payload->>'message_sid';
  sender text:=p_payload->>'from_phone';
  recipient text:=p_payload->>'to_phone';
  digits text;
  person uuid;
  campaign uuid;
  matches uuid[];
  q public.odeon_crm_cutover_queue;
  existing public.messages;
BEGIN
  PERFORM pg_advisory_xact_lock(8675311);
  IF sid IS NULL OR sid !~ '^SM[0-9a-fA-F]{32}$'
    OR sender IS NULL OR sender !~ '^\+[1-9][0-9]{6,14}$'
    OR recipient IS NULL OR recipient !~ '^\+[1-9][0-9]{6,14}$'
    OR jsonb_typeof(p_payload->'body') IS DISTINCT FROM 'string'
    OR NOT EXISTS(SELECT 1 FROM public.twilio_config WHERE tenant_id=p_tenant_id AND phone_number=recipient)
    OR p_received_at>now()+interval '5 minutes'
  THEN RAISE EXCEPTION 'Invalid SMS receipt'; END IF;
  IF EXISTS(SELECT 1 FROM public.sms_deleted_receipts WHERE tenant_id=p_tenant_id AND twilio_sid=sid)
  THEN RETURN 'deleted'; END IF;
  SELECT * INTO existing FROM public.messages WHERE tenant_id=p_tenant_id AND twilio_sid=sid;
  IF FOUND THEN
    IF existing.direction<>'inbound' OR existing.body IS DISTINCT FROM p_payload->>'body'
      OR existing.from_phone IS DISTINCT FROM sender OR existing.to_phone IS DISTINCT FROM recipient
    THEN RAISE EXCEPTION 'SMS identity conflict'; END IF;
    RETURN 'existing';
  END IF;
  PERFORM public.odeon_crm_capture(p_tenant_id,'inbound_sms',sid,p_payload);
  SELECT * INTO q FROM public.odeon_crm_cutover_queue
    WHERE tenant_id=p_tenant_id AND kind='inbound_sms' AND delivery_key=sid FOR UPDATE;
  IF q.message_persisted_at IS NOT NULL THEN RAISE EXCEPTION 'Missing persisted SMS requires review'; END IF;
  IF p_received_at IS NOT NULL THEN
    UPDATE public.odeon_crm_cutover_queue SET received_at=p_received_at WHERE id=q.id;
    q.received_at:=p_received_at;
  END IF;
  digits:=regexp_replace(sender,'[^0-9]','','g');
  IF length(digits)=11 AND left(digits,1)='1' THEN digits:=substr(digits,2); END IF;
  SELECT contact_id,campaign_id INTO person,campaign FROM public.messages
    WHERE tenant_id=p_tenant_id AND direction='outbound' AND to_phone IN(sender,digits)
      AND created_at<=q.received_at ORDER BY created_at DESC,id DESC LIMIT 1;
  IF person IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.people WHERE id=person AND tenant_id=p_tenant_id)
  THEN person:=NULL; END IF;
  IF person IS NULL THEN
    SELECT array_agg(id) INTO matches FROM public.people WHERE tenant_id=p_tenant_id AND phone IN(sender,digits);
    IF cardinality(matches)=1 THEN person:=matches[1]; END IF;
  END IF;
  IF campaign IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.campaigns WHERE id=campaign AND tenant_id=p_tenant_id)
  THEN campaign:=NULL; END IF;
  BEGIN
    INSERT INTO public.messages(id,tenant_id,contact_id,campaign_id,channel,direction,body,status,twilio_sid,created_at,from_phone,to_phone)
      VALUES(q.id,p_tenant_id,person,campaign,'sms','inbound',p_payload->>'body','received',sid,q.received_at,sender,recipient);
  EXCEPTION WHEN foreign_key_violation THEN
    INSERT INTO public.messages(id,tenant_id,contact_id,campaign_id,channel,direction,body,status,twilio_sid,created_at,from_phone,to_phone)
      VALUES(q.id,p_tenant_id,NULL,NULL,'sms','inbound',p_payload->>'body','received',sid,q.received_at,sender,recipient);
  END;
  IF person IS NOT NULL AND upper(btrim(p_payload->>'body')) IN('STOP','START') THEN
    UPDATE public.people SET opted_out=(upper(btrim(p_payload->>'body'))='STOP') WHERE id=person AND tenant_id=p_tenant_id;
  END IF;
  UPDATE public.odeon_crm_cutover_queue SET message_persisted_at=now() WHERE id=q.id;
  RETURN 'saved';
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_sms_receive(uuid,jsonb,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_sms_receive(uuid,jsonb,timestamptz) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;