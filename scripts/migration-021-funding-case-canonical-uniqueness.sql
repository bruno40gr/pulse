-- Migration 021: Align funded-case uniqueness with canonical case identity.
--
-- Migration 018 enforced one case per tenant and compatibility student-payer
-- link for all time. Migration 019 defines canonical case identity as student x
-- funding organization and permits a new active case after the prior case is
-- archived. Remove only the obsolete compatibility constraint and retain one
-- non-archived canonical case per student and organization.

BEGIN;

ALTER TABLE public.funding_cases
  DROP CONSTRAINT IF EXISTS funding_cases_tenant_id_student_payer_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS funding_cases_student_organization_unique
  ON public.funding_cases (tenant_id, student_id, funding_organization_id)
  WHERE funding_organization_id IS NOT NULL AND archived_at IS NULL;

COMMIT;