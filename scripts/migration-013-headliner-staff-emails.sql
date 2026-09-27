-- Migration 013: Add verified emails for 13 existing Headliner staff people.
--
-- Supplied and reconciled September 26, 2026. This migration intentionally:
--   - updates only exact, pre-verified person UUIDs in the Headliner tenant;
--   - requires each target to have an eligible account membership;
--   - requires the existing email to be empty or already equal to the target;
--   - aborts if an email is already used by another person or Auth user;
--   - does not create Auth users, send invitations, or activate memberships;
--   - does not include Mae Strider, whose email already exists, or Alex Bird,
--     whose staff record is scheduled separately by Migration 014.

BEGIN;

CREATE TEMP TABLE odeon_staff_email_updates (
  person_id UUID PRIMARY KEY,
  expected_first_name TEXT NOT NULL,
  expected_last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
) ON COMMIT DROP;

INSERT INTO odeon_staff_email_updates (
  person_id,
  expected_first_name,
  expected_last_name,
  email
)
VALUES
  ('a8e910e8-17a7-4ed6-aa22-757b21cae882', 'Alyssa', 'Abbott', 'aaabbott1@hotmail.com'),
  ('9f6ee1f9-4f28-474e-a8ca-0291481dd507', 'Josh', 'Brent', 'jrpbrent@gmail.com'),
  ('02004011-c2c7-4ddd-8d63-8372eb40b715', 'Noah', 'Campos', 'camposdnoah@gmail.com'),
  ('5be8b026-82b2-45ad-9a72-c3e956cb84b2', 'Collin', 'Franks', 'collin.m.franks@gmail.com'),
  ('dc99e720-99b2-4f12-a719-937e1eefaa35', 'Scott', 'Gaona', 'sgaona402@gmail.com'),
  ('282381ed-7c77-43ca-9be4-6905591d4a20', 'David', 'James', 'davidvjames@gmail.com'),
  ('0aa2581c-714a-4e58-b2b8-97d8ddaab699', 'Marshall', 'James-Solano', 'applepiie747@gmail.com'),
  ('a965f1d3-0387-4916-ab29-985de96e1090', 'Mel', 'Solano-Rojas', 'b2rrocklin@gmail.com'),
  ('e1a289fa-f04f-4b3d-84e7-a8543f0d5258', 'Isaias', 'Pallib', 'luciejoy42@gmail.com'),
  ('deda28bc-8371-4492-b2ef-87dd77e9c794', 'Cohen', 'Roden', 'james_c_drone@hotmail.com'),
  ('f6e72f5e-ddb4-4773-8ac7-1bed0f8b2f54', 'Lorena', 'Rudha', 'lorena@headlinermusicacademy.com'),
  ('55348d24-f463-418c-9b22-d293688fa8e0', 'Jacob', 'Rogelstad', 'jrogelstad@att.net'),
  ('14f47a3a-12f7-46e5-aace-30a71c6951d1', 'Jessica', 'Suase', 'jjdaniellemateo@gmail.com');

DO $$
DECLARE
  headliner_tenant_id CONSTANT UUID := '00000000-0000-0000-0000-000000000001';
  invalid_target_count INTEGER;
  duplicate_person_email_count INTEGER;
  auth_email_conflict_count INTEGER;
BEGIN
  SELECT count(*)
  INTO invalid_target_count
  FROM odeon_staff_email_updates AS update_row
  LEFT JOIN public.people AS person
    ON person.id = update_row.person_id
   AND person.tenant_id = headliner_tenant_id
  LEFT JOIN public.tenant_memberships AS membership
    ON membership.tenant_id = headliner_tenant_id
   AND membership.person_id = update_row.person_id
   AND membership.status IN ('unclaimed', 'invited', 'active')
  WHERE person.id IS NULL
     OR lower(trim(person.first_name)) <> lower(trim(update_row.expected_first_name))
     OR lower(trim(person.last_name)) <> lower(trim(update_row.expected_last_name))
     OR membership.id IS NULL
     OR (
       nullif(trim(person.email), '') IS NOT NULL
       AND lower(trim(person.email)) <> lower(update_row.email)
     );

  IF invalid_target_count > 0 THEN
    RAISE EXCEPTION 'Migration 013 aborted: % staff targets no longer match the verified identity, membership, or current-email state.', invalid_target_count;
  END IF;

  SELECT count(*)
  INTO duplicate_person_email_count
  FROM odeon_staff_email_updates AS update_row
  JOIN public.people AS existing_person
    ON lower(trim(existing_person.email)) = lower(update_row.email)
   AND existing_person.id <> update_row.person_id;

  IF duplicate_person_email_count > 0 THEN
    RAISE EXCEPTION 'Migration 013 aborted: % supplied emails are already assigned to other people.', duplicate_person_email_count;
  END IF;

  SELECT count(*)
  INTO auth_email_conflict_count
  FROM odeon_staff_email_updates AS update_row
  JOIN auth.users AS auth_user
    ON lower(trim(auth_user.email)) = lower(update_row.email);

  IF auth_email_conflict_count > 0 THEN
    RAISE EXCEPTION 'Migration 013 aborted: % supplied emails already belong to Supabase Auth users.', auth_email_conflict_count;
  END IF;
END;
$$;

UPDATE public.people AS person
SET email = lower(update_row.email)
FROM odeon_staff_email_updates AS update_row
WHERE person.id = update_row.person_id
  AND person.tenant_id = '00000000-0000-0000-0000-000000000001'::UUID
  AND (
    nullif(trim(person.email), '') IS NULL
    OR lower(trim(person.email)) = lower(update_row.email)
  );

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT count(*)
  INTO updated_count
  FROM odeon_staff_email_updates AS update_row
  JOIN public.people AS person
    ON person.id = update_row.person_id
   AND lower(trim(person.email)) = lower(update_row.email);

  IF updated_count <> 13 THEN
    RAISE EXCEPTION 'Migration 013 aborted: expected 13 verified staff emails after update, found %.', updated_count;
  END IF;
END;
$$;

COMMIT;