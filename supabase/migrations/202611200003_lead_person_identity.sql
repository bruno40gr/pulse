-- An existing person can be a student, an instructor and a lead at the same time
-- (docs/family-migration-preview.md). A lead about that person references them
-- directly instead of cloning a second contact record.
--
-- ORDER MATTERS: lead_intakes.contact_id is ON DELETE CASCADE. Clear contact_id
-- first, then delete the now-unreferenced display shells. Deleting shells first
-- destroys the linked leads.
BEGIN;

ALTER TABLE public.lead_intakes ADD COLUMN IF NOT EXISTS person_id uuid;
CREATE INDEX IF NOT EXISTS lead_intakes_person_idx ON public.lead_intakes (tenant_id, person_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'people')
     AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_intakes_person_id_fkey') THEN
    ALTER TABLE public.lead_intakes
      ADD CONSTRAINT lead_intakes_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill only from verified links, never by name.
UPDATE public.lead_intakes l
   SET person_id = link.person_id
  FROM public.contact_band_opportunity_links link
 WHERE link.tenant_id = l.tenant_id AND link.lead_id = l.id AND l.person_id IS NULL;

ALTER TABLE public.lead_intakes ALTER COLUMN contact_id DROP NOT NULL;
UPDATE public.lead_intakes SET contact_id = NULL WHERE person_id IS NOT NULL;
DELETE FROM public.crm_contacts c
 WHERE NOT EXISTS (SELECT 1 FROM public.lead_intakes l WHERE l.contact_id = c.id)
   AND c.email IS NULL AND c.phone IS NULL AND coalesce(c.notes, '') = ''
   AND NOT EXISTS (SELECT 1 FROM public.job_applications j WHERE j.contact_id = c.id);

COMMIT;
