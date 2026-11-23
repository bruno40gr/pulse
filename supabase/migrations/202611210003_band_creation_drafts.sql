-- Primary contacts DB. Review/apply after band_profiles and band_memberships.
BEGIN;
ALTER TABLE public.band_profiles ADD COLUMN IF NOT EXISTS description text;
CREATE TABLE IF NOT EXISTS public.band_creation_drafts (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  id uuid NOT NULL,
  revision bigint NOT NULL DEFAULT 0,
  state jsonb NOT NULL,
  updated_by uuid NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,id)
);
ALTER TABLE public.band_creation_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_creation_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.band_creation_drafts TO service_role;

CREATE OR REPLACE FUNCTION public.save_band_creation_draft(p_tenant uuid,p_actor uuid,p_revision bigint,p_state jsonb,p_complete boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public AS $$
DECLARE current_row band_creation_drafts; draft_id uuid := (p_state->>'id')::uuid;
  band text := btrim(p_state->'data'->>'name'); member uuid; coach uuid;
BEGIN
  -- Serialize creation/name collision checks in this tenant, without overwriting
  -- an existing band's profile when a draft is completed or a response is lost.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text, 210003));
  IF p_state->>'kind' <> 'group' OR p_state->>'institution' <> 'music'
    OR p_state->'data'->>'id' <> draft_id::text OR p_state->'data'->>'formation' <> 'true'
    OR jsonb_typeof(p_state->'data'->'memberIds') <> 'array' OR p_revision < 0 THEN
    RAISE EXCEPTION 'Invalid band draft';
  END IF;
  SELECT * INTO current_row FROM band_creation_drafts WHERE tenant_id=p_tenant AND id=draft_id FOR UPDATE;
  IF FOUND AND current_row.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object('revision',current_row.revision,'completed',true,'band',current_row.state->'data'->>'name');
  END IF;
  IF (current_row.id IS NULL AND p_revision<>0) OR (current_row.id IS NOT NULL AND current_row.revision<>p_revision) THEN
    RETURN jsonb_build_object('conflict',true);
  END IF;
  coach := nullif(p_state->'data'->>'leader','')::uuid;
  IF coach IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructors s JOIN people p ON p.id=s.person_id AND p.tenant_id=p_tenant
    WHERE s.tenant_id=p_tenant AND s.person_id=coach AND coalesce(p.custom_fields->>'staff_status','active')<>'sunset') THEN RAISE EXCEPTION 'Invalid teacher'; END IF;
  FOR member IN SELECT value::uuid FROM jsonb_array_elements_text(p_state->'data'->'memberIds') LOOP
    IF NOT EXISTS (SELECT 1 FROM students s JOIN people p ON p.id=s.person_id AND p.tenant_id=p_tenant
      WHERE s.tenant_id=p_tenant AND s.person_id=member) THEN RAISE EXCEPTION 'Invalid student'; END IF;
  END LOOP;
  IF p_complete THEN
    IF band IS NULL OR length(band)=0 OR length(band)>200 THEN RAISE EXCEPTION 'Invalid band name'; END IF;
    IF EXISTS (SELECT 1 FROM band_profiles WHERE tenant_id=p_tenant AND lower(band_name)=lower(band))
      OR EXISTS (SELECT 1 FROM band_memberships WHERE tenant_id=p_tenant AND lower(band_name)=lower(band))
      OR EXISTS (SELECT 1 FROM enrollments WHERE tenant_id=p_tenant
        AND (lower(custom_fields->>'band_name')=lower(band) OR lower(session_name)=lower(band))) THEN
      RAISE EXCEPTION 'Band already exists';
    END IF;
    INSERT INTO band_profiles(tenant_id,band_name,status,description,coach_person_id)
      VALUES(p_tenant,band,'active',p_state->'data'->>'description',coach);
    FOR member IN SELECT value::uuid FROM jsonb_array_elements_text(p_state->'data'->'memberIds') LOOP
      INSERT INTO band_memberships(tenant_id,band_name,person_id,membership) VALUES(p_tenant,band,member,'prospect');
    END LOOP;
  END IF;
  INSERT INTO band_creation_drafts(tenant_id,id,revision,state,updated_by,completed_at)
    VALUES(p_tenant,draft_id,p_revision+1,p_state,p_actor,CASE WHEN p_complete THEN now() ELSE NULL END)
    ON CONFLICT(tenant_id,id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state,
      updated_by=p_actor,updated_at=now(),completed_at=EXCLUDED.completed_at;
  RETURN jsonb_build_object('revision',p_revision+1,'completed',p_complete,'band',band);
END;
$$;
REVOKE ALL ON FUNCTION public.save_band_creation_draft(uuid,uuid,bigint,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_band_creation_draft(uuid,uuid,bigint,jsonb,boolean) TO service_role;
COMMIT;