-- CRM database only. Primary people/membership UUIDs are verified by the API;
-- the databases may be separate, so cross-database foreign keys are impossible.
-- Inquiry payload compatibility is transactional: existing table/bulk/intake
-- writers continue to work; Contacts reads the same record, never a copied note.
BEGIN;

CREATE TABLE public.follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  person_id uuid,
  lead_intake_id uuid REFERENCES public.lead_intakes(id) ON DELETE RESTRICT,
  due_at timestamptz,
  message text CHECK (length(message) <= 12000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared', 'completed')),
  owner_membership_id uuid,
  updated_by_membership_id uuid,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (person_id IS NOT NULL OR lead_intake_id IS NOT NULL),
  CHECK (status <> 'open' OR due_at IS NOT NULL)
);
CREATE UNIQUE INDEX follow_ups_inquiry_context ON public.follow_ups(tenant_id, lead_intake_id) WHERE lead_intake_id IS NOT NULL;
CREATE UNIQUE INDEX follow_ups_contact_context ON public.follow_ups(tenant_id, person_id) WHERE lead_intake_id IS NULL;
CREATE INDEX follow_ups_person ON public.follow_ups(tenant_id, person_id);
CREATE INDEX follow_ups_due ON public.follow_ups(tenant_id, due_at) WHERE status = 'open';

CREATE TABLE public.follow_up_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  follow_up_id uuid NOT NULL REFERENCES public.follow_ups(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_history ENABLE ROW LEVEL SECURITY;
-- Hosted default ACLs may grant destructive rights to service_role. Reset its
-- inherited grants too before granting the deliberately bounded API surface.
REVOKE ALL ON public.follow_ups, public.follow_up_history FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.follow_ups TO service_role;
GRANT SELECT, INSERT ON public.follow_up_history TO service_role;

CREATE FUNCTION public.audit_follow_up() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  INSERT INTO public.follow_up_history(tenant_id, follow_up_id, snapshot)
    VALUES (NEW.tenant_id, NEW.id, to_jsonb(NEW));
  RETURN NEW;
END;
$$;
CREATE TRIGGER follow_up_audit AFTER INSERT OR UPDATE ON public.follow_ups
FOR EACH ROW EXECUTE FUNCTION public.audit_follow_up();

CREATE FUNCTION public.sync_inquiry_follow_up() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE due timestamptz; reminder text; previous public.follow_ups;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.payload->>'follow_up_at' IS NOT DISTINCT FROM NEW.payload->>'follow_up_at'
    AND OLD.payload->>'follow_up_note' IS NOT DISTINCT FROM NEW.payload->>'follow_up_note' THEN
    IF OLD.person_id IS DISTINCT FROM NEW.person_id THEN
      UPDATE public.follow_ups SET person_id = NEW.person_id, version = version + 1, updated_at = now()
        WHERE tenant_id = NEW.tenant_id AND lead_intake_id = NEW.id;
    END IF;
    -- Backfill still needs to create the record when it does not yet exist.
    IF EXISTS (SELECT 1 FROM public.follow_ups WHERE tenant_id = NEW.tenant_id AND lead_intake_id = NEW.id) THEN RETURN NEW; END IF;
  END IF;
  -- Never truncate or silently discard malformed legacy reminders. A bad date
  -- blocks migration/write so it can be repaired deliberately before rollout.
  due := nullif(NEW.payload->>'follow_up_at', '')::timestamptz;
  reminder := nullif(NEW.payload->>'follow_up_note', '');
  SELECT * INTO previous FROM public.follow_ups WHERE tenant_id = NEW.tenant_id AND lead_intake_id = NEW.id FOR UPDATE;
  IF previous.id IS NULL THEN
    IF due IS NULL AND reminder IS NULL THEN RETURN NEW; END IF;
    INSERT INTO public.follow_ups(tenant_id, person_id, lead_intake_id, due_at, message, status)
      VALUES (NEW.tenant_id, NEW.person_id, NEW.id, due, reminder, CASE WHEN due IS NULL THEN 'cleared' ELSE 'open' END);
  ELSE
    UPDATE public.follow_ups SET person_id = NEW.person_id, due_at = due, message = reminder,
      status = CASE WHEN due IS NULL THEN 'cleared' ELSE 'open' END,
      updated_by_membership_id = NULL, version = version + 1, updated_at = now()
      WHERE id = previous.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER inquiry_follow_up_sync AFTER INSERT OR UPDATE OF payload, person_id ON public.lead_intakes
FOR EACH ROW EXECUTE FUNCTION public.sync_inquiry_follow_up();

-- Backfill without updating inquiries: production has an updated_at trigger,
-- so even SET payload = payload would falsely mark legacy inquiries as edited.
-- Use the same date/message/status mapping as the compatibility trigger above.
INSERT INTO public.follow_ups(tenant_id, person_id, lead_intake_id, due_at, message, status)
SELECT tenant_id, person_id, id, nullif(payload->>'follow_up_at', '')::timestamptz,
  nullif(payload->>'follow_up_note', ''),
  CASE WHEN nullif(payload->>'follow_up_at', '') IS NULL THEN 'cleared' ELSE 'open' END
FROM public.lead_intakes
WHERE nullif(payload->>'follow_up_at', '') IS NOT NULL OR nullif(payload->>'follow_up_note', '') IS NOT NULL;

-- Authorized API supplies a verified primary person and active actor membership.
-- Version checks reject stale drafts; the inquiry row lock also serializes legacy
-- table/bulk writers, so they cannot race a modal edit into two records.
CREATE FUNCTION public.save_shared_follow_up(
  p_tenant uuid, p_person uuid, p_lead uuid, p_actor uuid,
  p_action text, p_expected_version integer, p_due timestamptz DEFAULT NULL, p_message text DEFAULT NULL
) RETURNS SETOF public.follow_ups
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE target public.follow_ups; inquiry public.lead_intakes; next_status text; previous_due timestamptz; previous_message text;
BEGIN
  IF p_tenant IS NULL OR p_person IS NULL OR p_actor IS NULL OR p_action IS NULL OR p_action NOT IN ('save', 'clear', 'complete')
    OR p_expected_version IS NULL OR p_expected_version < 0 OR length(p_message) > 12000
    OR (p_action = 'save' AND p_due IS NULL) THEN RAISE EXCEPTION 'Invalid follow-up'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant::text || ':follow-up:' || coalesce(p_lead, p_person)::text, 0));
  IF p_lead IS NOT NULL THEN
    SELECT * INTO inquiry FROM public.lead_intakes WHERE id = p_lead AND tenant_id = p_tenant FOR UPDATE;
    IF NOT FOUND OR inquiry.person_id IS DISTINCT FROM p_person THEN RAISE EXCEPTION 'Inquiry not found'; END IF;
  END IF;
  SELECT * INTO target FROM public.follow_ups WHERE tenant_id = p_tenant
    AND ((p_lead IS NOT NULL AND lead_intake_id = p_lead) OR (p_lead IS NULL AND lead_intake_id IS NULL AND person_id = p_person)) FOR UPDATE;
  IF coalesce(target.version, 0) <> p_expected_version THEN RAISE EXCEPTION 'Follow-up changed' USING ERRCODE = '40001'; END IF;
  IF p_action <> 'save' AND (target.id IS NULL OR target.status <> 'open') THEN RAISE EXCEPTION 'No open follow-up'; END IF;
  previous_due := target.due_at;
  previous_message := target.message;
  next_status := CASE p_action WHEN 'save' THEN 'open' WHEN 'complete' THEN 'completed' ELSE 'cleared' END;
  IF p_lead IS NOT NULL THEN
    UPDATE public.lead_intakes SET updated_at = now(), payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
      'follow_up_at', CASE WHEN p_action = 'save' THEN to_jsonb(p_due) ELSE 'null'::jsonb END,
      'follow_up_note', CASE WHEN p_action = 'save' THEN to_jsonb(nullif(trim(p_message), '')) ELSE 'null'::jsonb END
    ) WHERE tenant_id = p_tenant AND id = p_lead;
    -- The trigger created/updated the row in this same transaction.
    SELECT * INTO target FROM public.follow_ups WHERE tenant_id = p_tenant AND lead_intake_id = p_lead;
  END IF;
  IF target.id IS NULL THEN
    INSERT INTO public.follow_ups(tenant_id, person_id, due_at, message, owner_membership_id, updated_by_membership_id)
      VALUES (p_tenant, p_person, p_due, nullif(trim(p_message), ''), p_actor, p_actor) RETURNING * INTO target;
  ELSE
    UPDATE public.follow_ups SET status = next_status,
      due_at = CASE WHEN p_action = 'save' THEN p_due WHEN p_action = 'complete' THEN previous_due ELSE NULL END,
      message = CASE WHEN p_action = 'save' THEN nullif(trim(p_message), '') ELSE previous_message END,
      owner_membership_id = coalesce(owner_membership_id, p_actor), updated_by_membership_id = p_actor,
      version = version + 1, updated_at = now()
      WHERE id = target.id RETURNING * INTO target;
  END IF;
  RETURN NEXT target;
END;
$$;
REVOKE ALL ON FUNCTION public.save_shared_follow_up(uuid, uuid, uuid, uuid, text, integer, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_shared_follow_up(uuid, uuid, uuid, uuid, text, integer, timestamptz, text) TO service_role;
REVOKE ALL ON FUNCTION public.sync_inquiry_follow_up(), public.audit_follow_up() FROM PUBLIC, anon, authenticated;
COMMIT;