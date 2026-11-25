-- Run only in an empty disposable PostgreSQL 17 database; no production access.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
-- Supabase's server role bypasses RLS; browser roles must still have no grants.
CREATE ROLE service_role BYPASSRLS;
CREATE TABLE public.lead_intakes (
  id uuid PRIMARY KEY, tenant_id uuid NOT NULL, person_id uuid,
  payload jsonb DEFAULT '{}'::jsonb, status text DEFAULT 'contacted', updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.lead_intakes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_intakes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.lead_intakes TO service_role;
-- Match production's BEFORE UPDATE timestamp trigger. Backfill must not fire it.
CREATE FUNCTION public.fixture_touch_inquiry() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER fixture_touch_inquiry BEFORE UPDATE ON public.lead_intakes
FOR EACH ROW EXECUTE FUNCTION public.fixture_touch_inquiry();
INSERT INTO public.lead_intakes(id, tenant_id, person_id, payload, updated_at) VALUES (
  '22222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000001', '11111111-1111-4111-8111-111111111111',
  '{"follow_up_at":"2026-12-01T20:00:00Z","follow_up_note":"Keep the message","student_name":"Keep student"}',
  '2026-11-01T12:00:00Z'
);
INSERT INTO public.lead_intakes(id, tenant_id, payload, updated_at) VALUES
  ('22222222-2222-4222-8222-222222222223', '00000000-0000-0000-0000-000000000001',
    '{"follow_up_at":"2026-12-03T20:00:00Z","follow_up_note":"Unlinked inquiry reminder"}', '2026-11-01T12:00:00Z'),
  ('22222222-2222-4222-8222-222222222224', '00000000-0000-0000-0000-000000000001',
    '{"follow_up_note":"Historical note without a date"}', '2026-11-01T12:00:00Z');
\i /tmp/shared-follow-ups-migration.sql

DO $$
DECLARE tenant uuid := '00000000-0000-0000-0000-000000000001'; person uuid := '11111111-1111-4111-8111-111111111111';
  lead uuid := '22222222-2222-4222-8222-222222222222'; actor uuid := '44444444-4444-4444-8444-444444444444';
  item public.follow_ups; previous_version integer;
BEGIN
  ASSERT (SELECT count(*) = 3 FROM public.follow_ups), 'Backfill missed a legacy context';
  ASSERT (SELECT count(*) = 3 FROM public.follow_up_history), 'Backfill snapshots are missing';
  ASSERT (SELECT count(*) = 3 FROM public.lead_intakes WHERE updated_at = '2026-11-01T12:00:00Z'::timestamptz), 'Backfill touched legacy inquiry timestamps';
  ASSERT (SELECT person_id IS NULL AND status = 'open' AND message = 'Unlinked inquiry reminder'
    FROM public.follow_ups WHERE lead_intake_id = '22222222-2222-4222-8222-222222222223'), 'Unlinked reminder was lost or identity invented';
  ASSERT (SELECT person_id IS NULL AND status = 'cleared' AND due_at IS NULL AND message = 'Historical note without a date'
    FROM public.follow_ups WHERE lead_intake_id = '22222222-2222-4222-8222-222222222224'), 'Note-only history was lost or scheduled';
  SELECT * INTO STRICT item FROM public.follow_ups WHERE lead_intake_id = lead;
  ASSERT item.message = 'Keep the message' AND item.version = 1 AND item.status = 'open', 'Legacy backfill lost data';
  ASSERT (SELECT updated_at = '2026-11-01T12:00:00Z'::timestamptz
    AND payload = '{"follow_up_at":"2026-12-01T20:00:00Z","follow_up_note":"Keep the message","student_name":"Keep student"}'::jsonb
    FROM public.lead_intakes WHERE id = lead), 'Backfill changed inquiry payload/timestamp';
  UPDATE public.lead_intakes SET status = 'won' WHERE id = lead;
  ASSERT (SELECT message = 'Keep the message' AND status = 'open' FROM public.follow_ups WHERE id = item.id), 'Won removed follow-up';
  SELECT * INTO STRICT item FROM public.save_shared_follow_up(tenant, person, lead, actor, 'save', item.version, '2026-12-02T20:00:00Z', 'Changed from Contacts');
  ASSERT item.message = 'Changed from Contacts' AND item.owner_membership_id = actor, 'Modal save/ownership failed';
  ASSERT (SELECT payload->>'follow_up_note' = item.message AND payload->>'student_name' = 'Keep student' FROM public.lead_intakes WHERE id = lead), 'Inquiry compatibility failed';
  BEGIN
    PERFORM public.save_shared_follow_up(tenant, person, lead, actor, 'save', 1, now(), 'Stale draft');
    RAISE EXCEPTION 'Stale edit was accepted';
  EXCEPTION WHEN serialization_failure THEN NULL; END;
  previous_version := item.version;
  UPDATE public.lead_intakes SET payload = payload || '{"follow_up_note":"Changed in Leads table"}' WHERE id = lead;
  SELECT * INTO STRICT item FROM public.follow_ups WHERE lead_intake_id = lead;
  ASSERT item.message = 'Changed in Leads table' AND item.version > previous_version, 'Legacy edit did not update shared record';
  SELECT * INTO STRICT item FROM public.save_shared_follow_up(tenant, person, lead, actor, 'complete', item.version);
  ASSERT item.status = 'completed' AND item.message = 'Changed in Leads table' AND item.due_at IS NOT NULL, 'Completion discarded history';
  ASSERT (SELECT payload->>'follow_up_at' IS NULL AND payload->>'follow_up_note' IS NULL FROM public.lead_intakes WHERE id = lead), 'Completed reminder still actionable in Leads';
  UPDATE public.lead_intakes SET payload = payload || '{"unrelated":"kept"}' WHERE id = lead;
  ASSERT (SELECT status = 'completed' AND message = 'Changed in Leads table' FROM public.follow_ups WHERE id = item.id), 'Unrelated edit destroyed completion';
  UPDATE public.lead_intakes SET payload = payload || '{"follow_up_at":"2026-12-02T20:00:00Z","follow_up_note":"Changed in Leads table"}' WHERE id = lead;
  ASSERT (SELECT status = 'open' FROM public.follow_ups WHERE id = item.id), 'Explicitly rescheduling the same reminder failed to reopen it';
  SELECT * INTO STRICT item FROM public.save_shared_follow_up(tenant, person, NULL, actor, 'save', 0, now(), 'General contact reminder');
  ASSERT (SELECT count(*) = 2 FROM public.follow_ups WHERE person_id = person), 'General and inquiry contexts were conflated';
  SELECT * INTO STRICT item FROM public.save_shared_follow_up(tenant, person, NULL, actor, 'clear', item.version);
  ASSERT item.status = 'cleared' AND item.message = 'General contact reminder', 'Clear lost history or implied completion';
  ASSERT (SELECT count(*) >= 7 FROM public.follow_up_history), 'History is missing';
  ASSERT NOT has_table_privilege('authenticated', 'public.follow_ups', 'SELECT'), 'Untrusted role can read shared reminders';
  ASSERT NOT has_function_privilege('anon', 'public.save_shared_follow_up(uuid,uuid,uuid,uuid,text,integer,timestamptz,text)', 'EXECUTE'), 'Untrusted role can write shared reminders';
  RAISE NOTICE 'PASS: non-mutating backfill, Won preservation, compatibility in both directions, ownership, conflict, complete, clear, history and restricted grants';
END;
$$;