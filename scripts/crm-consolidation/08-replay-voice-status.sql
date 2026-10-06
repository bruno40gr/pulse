-- DRAFT / LOCAL ONLY. Signed callbacks must be captured before replay.
BEGIN;
CREATE FUNCTION public.odeon_crm_replay_voice_status(p_queue_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  q public.odeon_crm_cutover_queue;
  sid text;
  status_value text;
  sequence_value bigint;
  duration_value bigint;
  target public.lead_events;
  matches uuid[];
  previous_sequence bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(8675310);
  SELECT * INTO q FROM public.odeon_crm_cutover_queue WHERE id=p_queue_id FOR UPDATE;
  IF NOT FOUND OR q.kind<>'voice_status' THEN RAISE EXCEPTION 'Voice capture missing'; END IF;
  sid:=q.payload->>'call_sid'; status_value:=q.payload->>'status';
  IF sid IS NULL OR sid !~ '^CA[0-9a-fA-F]{32}$'
    OR status_value IS NULL OR status_value NOT IN
      ('queued','initiated','ringing','in-progress','completed','busy','no-answer','failed','canceled')
    OR coalesce(q.payload->>'sequence','') !~ '^[0-9]{1,9}$'
    OR (q.payload->>'duration' IS NOT NULL AND q.payload->>'duration' !~ '^[0-9]{1,9}$')
    OR (q.payload ? 'tenant_id' AND q.payload->>'tenant_id' IS DISTINCT FROM q.tenant_id::text)
  THEN RAISE EXCEPTION 'Invalid voice payload'; END IF;
  sequence_value:=(q.payload->>'sequence')::bigint;
  duration_value:=(q.payload->>'duration')::bigint;
  IF q.delivery_key IS DISTINCT FROM sid||':'||sequence_value::text
  THEN RAISE EXCEPTION 'Voice delivery key mismatch'; END IF;
  SELECT array_agg(id) INTO matches FROM public.lead_events
    WHERE tenant_id=q.tenant_id AND event_type='call_started' AND payload->>'call_sid'=sid;
  IF coalesce(cardinality(matches),0)<>1 THEN RAISE EXCEPTION 'Voice history unresolved or ambiguous'; END IF;
  SELECT * INTO target FROM public.lead_events WHERE id=matches[1] FOR UPDATE;
  IF NOT EXISTS (SELECT 1 FROM public.lead_intakes WHERE id=target.lead_intake_id
    AND tenant_id=q.tenant_id) OR (target.contact_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM public.crm_contacts WHERE id=target.contact_id AND tenant_id=q.tenant_id))
  THEN RAISE EXCEPTION 'Voice history tenant mismatch'; END IF;
  IF q.completed_at IS NOT NULL THEN RETURN target.id; END IF;
  IF EXISTS (SELECT 1 FROM public.odeon_crm_cutover_queue WHERE completed_at IS NULL
    AND (received_at,id)<(q.received_at,q.id))
  THEN RAISE EXCEPTION 'Earlier queued event pending'; END IF;
  IF target.payload ? 'callback_sequence' THEN
    IF coalesce(target.payload->>'callback_sequence','') !~ '^[0-9]{1,9}$'
    THEN RAISE EXCEPTION 'Existing voice sequence invalid'; END IF;
    previous_sequence:=(target.payload->>'callback_sequence')::bigint;
  END IF;
  IF previous_sequence=sequence_value AND
    (target.payload->>'status' IS DISTINCT FROM status_value OR
      target.payload->'duration' IS DISTINCT FROM coalesce(to_jsonb(duration_value),'null'::jsonb))
  THEN RAISE EXCEPTION 'Voice sequence conflict'; END IF;
  IF previous_sequence IS NULL OR sequence_value>previous_sequence THEN
    UPDATE public.lead_events SET
      event_label=CASE status_value
        WHEN 'completed' THEN 'Call completed' WHEN 'busy' THEN 'Call busy'
        WHEN 'no-answer' THEN 'Call not answered' WHEN 'failed' THEN 'Call failed'
        WHEN 'canceled' THEN 'Call canceled' ELSE 'Call '||status_value END,
      payload=target.payload||jsonb_build_object('status',status_value,'duration',duration_value,
        'callback_sequence',sequence_value,'callback_received_at',q.received_at)
      WHERE id=target.id AND tenant_id=q.tenant_id;
  END IF;
  UPDATE public.odeon_crm_cutover_queue SET completed_at=now() WHERE id=q.id;
  RETURN target.id;
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_crm_replay_voice_status(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_replay_voice_status(uuid) TO service_role;
COMMIT;