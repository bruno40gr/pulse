-- DRAFT / LOCAL ONLY. CRM history projection, NOT full message or consent replay.
-- Caller must validate provider signature and durably record message/STOP/START first.
BEGIN;
CREATE FUNCTION public.odeon_crm_replay_sms_history(p_queue_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  q public.odeon_crm_cutover_queue;
  sid text;
  sender text;
  digits text;
  contact uuid;
  matches uuid[];
  lead uuid;
  event uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(8675310);
  SELECT * INTO q FROM public.odeon_crm_cutover_queue WHERE id=p_queue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Queue record missing'; END IF;
  IF q.kind<>'inbound_sms' THEN RAISE EXCEPTION 'Unsupported replay kind'; END IF;
  sid := q.payload->>'message_sid';
  sender := q.payload->>'from_phone';
  IF sid IS NULL OR sid !~ '^SM[0-9a-fA-F]{32}$'
    OR sender IS NULL OR sender !~ '^\+[1-9][0-9]{6,14}$'
  THEN RAISE EXCEPTION 'Invalid SMS history payload'; END IF;
  IF q.delivery_key<>sid THEN RAISE EXCEPTION 'SMS delivery key mismatch'; END IF;
  IF q.payload ? 'tenant_id' AND q.payload->>'tenant_id' IS DISTINCT FROM q.tenant_id::text
  THEN RAISE EXCEPTION 'Payload tenant mismatch'; END IF;
  IF q.completed_at IS NOT NULL THEN
    SELECT id INTO event FROM public.lead_events WHERE tenant_id=q.tenant_id
      AND event_type='inbound_sms' AND payload->>'twilio_sid'=sid;
    IF event IS NULL THEN RAISE EXCEPTION 'Completed SMS history missing'; END IF;
    RETURN event;
  END IF;
  IF EXISTS (SELECT 1 FROM public.odeon_crm_cutover_queue WHERE completed_at IS NULL
    AND (received_at,id)<(q.received_at,q.id))
  THEN RAISE EXCEPTION 'Earlier queued event pending'; END IF;
  SELECT array_agg(id) INTO matches FROM public.lead_events WHERE tenant_id=q.tenant_id
    AND event_type='inbound_sms' AND payload->>'twilio_sid'=sid;
  IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Duplicate existing SMS history'; END IF;
  event := matches[1];
  IF event IS NULL THEN
    digits := regexp_replace(sender,'[^0-9]','','g');
    IF length(digits)=11 AND left(digits,1)='1' THEN digits:=substr(digits,2); END IF;
    SELECT array_agg(id) INTO matches FROM public.crm_contacts
      WHERE tenant_id=q.tenant_id AND regexp_replace(
        regexp_replace(coalesce(phone,''),'[^0-9]','','g'), '^1([0-9]{10})$', '\1')=digits;
    IF cardinality(matches)>1 THEN RAISE EXCEPTION 'Ambiguous SMS contact'; END IF;
    contact := matches[1];
    -- Keep unmatched messages pending for reviewed reconciliation, never silently discard.
    IF contact IS NULL THEN RAISE EXCEPTION 'SMS contact unresolved'; END IF;
    SELECT e.lead_intake_id INTO lead FROM public.lead_events e
      JOIN public.lead_intakes l ON l.id=e.lead_intake_id AND l.tenant_id=q.tenant_id
        AND l.contact_id=contact
      WHERE e.tenant_id=q.tenant_id AND e.contact_id=contact AND e.event_type='outbound_sms'
        AND e.created_at<=q.received_at
      ORDER BY e.created_at DESC,e.id DESC LIMIT 1;
    IF lead IS NULL THEN
      SELECT id INTO lead FROM public.lead_intakes WHERE tenant_id=q.tenant_id
        AND contact_id=contact AND created_at<=q.received_at
        ORDER BY created_at DESC,id DESC LIMIT 1;
    END IF;
    IF lead IS NULL THEN RAISE EXCEPTION 'SMS inquiry unresolved'; END IF;
    INSERT INTO public.lead_events(id,tenant_id,lead_intake_id,contact_id,event_type,
      event_label,payload,created_at)
    VALUES(q.id,q.tenant_id,lead,contact,'inbound_sms','Lead replied by text',
      jsonb_build_object('twilio_sid',sid),q.received_at) RETURNING id INTO event;
  END IF;
  UPDATE public.odeon_crm_cutover_queue SET completed_at=now() WHERE id=q.id;
  RETURN event;
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_crm_replay_sms_history(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_replay_sms_history(uuid) TO service_role;
COMMIT;