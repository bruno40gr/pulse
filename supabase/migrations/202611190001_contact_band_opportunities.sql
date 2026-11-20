BEGIN;

-- Apply to the CRM database. Person IDs are verified against the Contacts
-- database by the authorized API; cross-database foreign keys are unavailable.
CREATE TABLE public.contact_band_opportunity_links (
  tenant_id uuid NOT NULL,
  person_id uuid NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.lead_intakes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, person_id, lead_id),
  UNIQUE (tenant_id, lead_id)
);
ALTER TABLE public.contact_band_opportunity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contact_band_opportunity_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.contact_band_opportunity_links TO service_role;

-- Tentative associations are separate from enrollment and never copy a lead status.
CREATE TABLE public.band_tentative_groups (
  tenant_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX band_tentative_groups_unique_name ON public.band_tentative_groups (tenant_id, lower(trim(name)));
CREATE TABLE public.band_tentative_opportunities (
  tenant_id uuid NOT NULL,
  band_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, band_id, lead_id),
  FOREIGN KEY (tenant_id, band_id) REFERENCES public.band_tentative_groups(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, lead_id) REFERENCES public.contact_band_opportunity_links(tenant_id, lead_id) ON DELETE CASCADE
);
ALTER TABLE public.band_tentative_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_tentative_opportunities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.band_tentative_groups, public.band_tentative_opportunities FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.band_tentative_groups, public.band_tentative_opportunities TO service_role;

CREATE FUNCTION public.set_band_tentative_opportunities(p_tenant uuid, p_lead uuid, p_band_ids uuid[])
RETURNS integer LANGUAGE plpgsql SET search_path = public AS $$
DECLARE count_ids integer;
BEGIN
  IF p_tenant IS NULL OR p_lead IS NULL OR p_band_ids IS NULL OR cardinality(p_band_ids) > 100 THEN RAISE EXCEPTION 'Invalid selection'; END IF;
  SELECT count(DISTINCT id) INTO count_ids FROM unnest(p_band_ids) id WHERE id IS NOT NULL;
  IF count_ids <> cardinality(p_band_ids) THEN RAISE EXCEPTION 'Invalid selection'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text || ':band-opportunity', 0));
  IF NOT EXISTS (SELECT 1 FROM public.contact_band_opportunity_links x JOIN public.lead_intakes l ON l.id=x.lead_id AND l.tenant_id=x.tenant_id
    WHERE x.tenant_id=p_tenant AND x.lead_id=p_lead AND l.payload->>'service_type'='band') THEN RAISE EXCEPTION 'Opportunity unavailable'; END IF;
  IF (SELECT count(*) FROM public.band_tentative_groups WHERE tenant_id=p_tenant AND id=ANY(p_band_ids)) <> count_ids THEN RAISE EXCEPTION 'Band unavailable'; END IF;
  DELETE FROM public.band_tentative_opportunities WHERE tenant_id=p_tenant AND lead_id=p_lead;
  INSERT INTO public.band_tentative_opportunities (tenant_id, band_id, lead_id) SELECT p_tenant, id, p_lead FROM unnest(p_band_ids) id;
  RETURN count_ids;
END;
$$;
REVOKE ALL ON FUNCTION public.set_band_tentative_opportunities(uuid, uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_band_tentative_opportunities(uuid, uuid, uuid[]) TO service_role;

-- All selected students are processed in a single CRM transaction. Serialize
-- by tenant so concurrent submissions cannot create two open band opportunities.
CREATE FUNCTION public.create_contact_band_opportunities(p_tenant uuid, p_students jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE item jsonb; person uuid; student_name text; contact uuid; lead uuid;
  output jsonb := '[]'::jsonb; existing_ids uuid[];
BEGIN
  IF p_tenant IS NULL OR jsonb_typeof(p_students) <> 'array' OR jsonb_array_length(p_students) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid selection';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text || ':band-opportunity', 0));
  IF (SELECT count(*) FROM jsonb_array_elements(p_students)) <> (SELECT count(DISTINCT x->>'person_id') FROM jsonb_array_elements(p_students) x) THEN
    RAISE EXCEPTION 'Duplicate selection';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_students) LOOP
    person := (item->>'person_id')::uuid;
    student_name := trim(item->>'name');
    IF person IS NULL OR student_name IS NULL OR student_name = '' OR length(student_name) > 250 THEN
      RAISE EXCEPTION 'Invalid student';
    END IF;
    SELECT array_agg(l.id) INTO existing_ids FROM public.contact_band_opportunity_links link
      JOIN public.lead_intakes l ON l.id = link.lead_id AND l.tenant_id = link.tenant_id
      WHERE link.tenant_id = p_tenant AND link.person_id = person
        AND l.status NOT IN ('won', 'lost', 'ghosted_us', 'ghosted', 'spam');
    IF coalesce(array_length(existing_ids, 1), 0) > 0 THEN
      output := output || jsonb_build_array(jsonb_build_object('person_id', person, 'result', 'existing', 'lead_ids', to_jsonb(existing_ids)));
      CONTINUE;
    END IF;
    -- Legacy lead UI requires a CRM contact; this is a name-only display shell,
    -- not a new Contacts person or a copy of phone, email, status, or enrollment.
    INSERT INTO public.crm_contacts (tenant_id, full_name, contact_kind, lifecycle_stage)
      VALUES (p_tenant, student_name, 'lead', 'new') RETURNING id INTO contact;
    INSERT INTO public.lead_intakes (tenant_id, contact_id, intake_type, source_system, source_form, service_label, payload)
      VALUES (p_tenant, contact, 'service_inquiry', 'pulse-manual', 'contact-band-opportunity', 'Band',
        jsonb_build_object('student_name', student_name, 'service_type', 'band', 'opportunity_origin', 'staff_initiated')) RETURNING id INTO lead;
    INSERT INTO public.contact_band_opportunity_links (tenant_id, person_id, lead_id) VALUES (p_tenant, person, lead);
    output := output || jsonb_build_array(jsonb_build_object('person_id', person, 'result', 'created', 'lead_ids', jsonb_build_array(lead)));
  END LOOP;
  RETURN output;
END;
$$;
REVOKE ALL ON FUNCTION public.create_contact_band_opportunities(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_contact_band_opportunities(uuid, jsonb) TO service_role;
COMMIT;