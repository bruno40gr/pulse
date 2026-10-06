-- DRAFT / LOCAL ONLY. Website intake replay; SMS/callbacks are refused.
-- Invoker privileges. No external effects. Must run in the consolidated main DB.
BEGIN;
CREATE FUNCTION public.odeon_crm_replay_inquiry(p_queue_id uuid)
RETURNS uuid LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  q public.odeon_crm_cutover_queue;
  contact uuid;
  lead uuid;
  full_name_value text;
  email_value text;
  phone_value text;
  intake_type_value text;
  source_form_value text;
  metadata jsonb;
  positions_value text[];
  availability_value text[];
BEGIN
  -- Serialize replay workers: preserve ordering rather than skipping older items.
  PERFORM pg_advisory_xact_lock(8675310);
  SELECT * INTO q FROM public.odeon_crm_cutover_queue WHERE id=p_queue_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Queue record missing'; END IF;
  IF q.kind <> 'intake' THEN RAISE EXCEPTION 'Unsupported replay kind'; END IF;
  -- Deterministic record ID makes repeat calls return the same inquiry.
  IF q.completed_at IS NOT NULL THEN
    IF q.payload->>'intake_type'='job_application' THEN
      SELECT id INTO lead FROM public.job_applications WHERE id=q.id AND tenant_id=q.tenant_id;
    ELSE
      SELECT id INTO lead FROM public.lead_intakes WHERE id=q.id AND tenant_id=q.tenant_id;
    END IF;
    IF lead IS NULL THEN RAISE EXCEPTION 'Completed inquiry missing'; END IF;
    RETURN lead;
  END IF;
  IF EXISTS (SELECT 1 FROM public.odeon_crm_cutover_queue
      WHERE completed_at IS NULL
        AND (received_at,id)<(q.received_at,q.id))
   THEN RAISE EXCEPTION 'Earlier queued event pending'; END IF;
  IF q.payload ? 'tenant_id' AND q.payload->>'tenant_id' IS DISTINCT FROM q.tenant_id::text
  THEN RAISE EXCEPTION 'Payload tenant mismatch'; END IF;
  full_name_value := nullif(btrim(q.payload->>'full_name'),'');
  email_value := lower(nullif(btrim(q.payload->>'email'),''));
  phone_value := nullif(btrim(q.payload->>'phone'),'');
  intake_type_value := nullif(btrim(q.payload->>'intake_type'),'');
  source_form_value := nullif(btrim(q.payload->>'source_form'),'');
  IF intake_type_value IS NULL
    OR source_form_value IS NULL OR full_name_value IS NULL
    OR (email_value IS NULL AND phone_value IS NULL)
  THEN RAISE EXCEPTION 'Unsupported or invalid inquiry'; END IF;
  metadata := coalesce(q.payload->'payload','{}'::jsonb);
  IF jsonb_typeof(metadata)<>'object' THEN RAISE EXCEPTION 'Invalid inquiry metadata'; END IF;
  IF intake_type_value='job_application' THEN
    IF (metadata ? 'positions' AND jsonb_typeof(metadata->'positions')<>'array')
      OR (metadata ? 'availability' AND jsonb_typeof(metadata->'availability')<>'array')
    THEN RAISE EXCEPTION 'Invalid application arrays'; END IF;
    SELECT coalesce(array_agg(value #>> '{}'),'{}'::text[]) INTO positions_value
      FROM jsonb_array_elements(coalesce(metadata->'positions','[]'::jsonb))
      WHERE jsonb_typeof(value)='string';
    SELECT coalesce(array_agg(value #>> '{}'),'{}'::text[]) INTO availability_value
      FROM jsonb_array_elements(coalesce(metadata->'availability','[]'::jsonb))
      WHERE jsonb_typeof(value)='string';
  END IF;
  -- Match live intake behavior: never merge identities based on contact fields.
  -- Completed queue items already return above, so retries do not create contacts.
  IF contact IS NULL THEN
    INSERT INTO public.crm_contacts(tenant_id,full_name,first_name,last_name,email,phone,created_at,updated_at)
    VALUES(q.tenant_id,full_name_value,split_part(full_name_value,' ',1),
      nullif(btrim(substr(full_name_value,length(split_part(full_name_value,' ',1))+1)),''),
      email_value,phone_value,q.received_at,q.received_at)
    RETURNING id INTO contact;
  END IF;
  IF intake_type_value='job_application' THEN
    INSERT INTO public.job_applications(id,tenant_id,contact_id,full_name,email,phone,
      positions,availability,experience,sight_reading,resume_link,message,payload,created_at,updated_at)
    -- Preserve existing intake semantics for phone-only applications.
    VALUES(q.id,q.tenant_id,contact,full_name_value,coalesce(email_value,''),phone_value,
      positions_value,availability_value,coalesce(nullif(btrim(metadata->>'experience'),''),''),
      coalesce(nullif(btrim(metadata->>'sight_reading'),''),''),nullif(btrim(metadata->>'resume_link'),''),
      coalesce(nullif(btrim(metadata->>'message'),''),''),metadata,q.received_at,q.received_at)
    RETURNING id INTO lead;
  ELSE
  INSERT INTO public.lead_intakes(id,tenant_id,contact_id,intake_type,source_system,source_form,
    source_page,program_label,service_label,utm_source,utm_medium,utm_campaign,referrer,payload,
    created_at,updated_at)
  VALUES(q.id,q.tenant_id,contact,intake_type_value,
    coalesce(nullif(btrim(q.payload->>'source_system'),''),'headliner-website'),source_form_value,
    nullif(btrim(q.payload->>'source_page'),''),nullif(btrim(q.payload->>'program_label'),''),
    nullif(btrim(q.payload->>'service_label'),''),nullif(btrim(q.payload->>'utm_source'),''),
    nullif(btrim(q.payload->>'utm_medium'),''),nullif(btrim(q.payload->>'utm_campaign'),''),
    nullif(btrim(q.payload->>'referrer'),''),metadata,q.received_at,q.received_at)
  RETURNING id INTO lead;
  -- Creation trigger is required, and its history gets the original receipt time.
  IF (SELECT count(*) FROM public.lead_events
      WHERE tenant_id=q.tenant_id AND lead_intake_id=lead AND event_type='created')<>1
  THEN RAISE EXCEPTION 'Creation history trigger missing or unexpected'; END IF;
  UPDATE public.lead_events SET created_at=q.received_at
    WHERE tenant_id=q.tenant_id AND lead_intake_id=lead AND event_type='created';
  END IF;
  UPDATE public.odeon_crm_cutover_queue SET completed_at=now() WHERE id=q.id;
  RETURN lead;
END;
$$;
REVOKE ALL ON FUNCTION public.odeon_crm_replay_inquiry(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_replay_inquiry(uuid) TO service_role;
COMMIT;