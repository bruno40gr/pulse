-- DRAFT: run only AFTER historical import and content reconciliation.
-- Preserve source behavior, but use namespaced functions to avoid collisions.
-- Do not run in production until backup, rehearsal, and cutover gates are met.
BEGIN;

CREATE FUNCTION public.odeon_crm_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.odeon_crm_categorize_lead_intake()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.intake_type = 'tour_request' THEN
    NEW.category := 'tour';
    NEW.priority := 'high';
    NEW.temperature := 'hot';
  ELSIF NEW.intake_type = 'service_inquiry' THEN
    NEW.category := 'services';
  ELSIF NEW.program_label ILIKE '%tiny keys%' OR NEW.program_label ILIKE '%wonder notes%' THEN
    NEW.category := 'early_childhood';
  ELSIF NEW.program_label ILIKE '%private lessons%' THEN
    NEW.category := 'private_lessons';
  ELSIF NEW.intake_type = 'lesson_inquiry' THEN
    NEW.category := 'lessons';
  ELSE
    NEW.category := 'other';
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.odeon_crm_log_lead_intake_created()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  INSERT INTO public.lead_events (
    tenant_id, lead_intake_id, contact_id, event_type, event_label, payload
  ) VALUES (
    NEW.tenant_id, NEW.id, NEW.contact_id, 'created', 'Lead intake created',
    jsonb_build_object('status', NEW.status, 'category', NEW.category, 'intake_type', NEW.intake_type)
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.odeon_crm_set_updated_at(),
  public.odeon_crm_categorize_lead_intake(), public.odeon_crm_log_lead_intake_created()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.odeon_crm_set_updated_at(),
  public.odeon_crm_categorize_lead_intake(), public.odeon_crm_log_lead_intake_created()
  TO service_role;

CREATE TRIGGER trg_crm_contacts_updated_at BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.odeon_crm_set_updated_at();
CREATE TRIGGER trg_job_applications_updated_at BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.odeon_crm_set_updated_at();
CREATE TRIGGER trg_categorize_lead_intake BEFORE INSERT ON public.lead_intakes
  FOR EACH ROW EXECUTE FUNCTION public.odeon_crm_categorize_lead_intake();
CREATE TRIGGER trg_lead_intakes_updated_at BEFORE UPDATE ON public.lead_intakes
  FOR EACH ROW EXECUTE FUNCTION public.odeon_crm_set_updated_at();
CREATE TRIGGER trg_log_lead_intake_created AFTER INSERT ON public.lead_intakes
  FOR EACH ROW EXECUTE FUNCTION public.odeon_crm_log_lead_intake_created();

COMMIT;