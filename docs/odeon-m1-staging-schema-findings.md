# M1 — Approved staging metadata findings

**Scope:** User approved Odeon-staging only, for read-only schema metadata. No production database queries, application records, credentials, executable definitions or migration-history rows were requested. This is a curated compatibility summary, not a complete schema dump or migration approval.

## Confirmed structural findings

- `public.enrollments` contains both nullable UUID instructor references: `instructor_person_id` has a foreign key to `public.people`; `instructor_id` has a foreign key to `public.staff`.
- Its required UUID columns are `id`, `tenant_id` and `student_id`. Foreign keys exist to `tenants` and `students`.
- Lesson columns include `service_type`, `instrument`, `lesson_day`, `lesson_time`, `plan_name`, `session_name` and `status`; `custom_fields` is JSONB. `created_at` is a timestamp with time zone. No term-version or scenario column was returned for this table.
- The enrollment constraint query returned its primary key and four foreign keys, with no unique student-only constraint in that result. Index definitions and actual record cardinality were not inspected; do not infer full multi-enrollment readiness.
- Staging contains both `staff` and `instructors`, plus `student_accounts`, `account_contacts` and `account_holders`. Repository comments about structures being absent in production are not staging evidence and must not be treated as current production verification.
- RLS is enabled on the inspected people/student/enrollment/instructor/account relations. `staff`, `student_accounts` and `account_contacts` had zero policy objects in the catalog result. This alone does not determine effective access: grants, role membership, bypass privileges and policy expressions remain unreviewed.
- A `supabase_migrations.schema_migrations` relation exists. Applied version rows were deliberately not read.

## Integration consequences

1. Do not copy an `instructors.id` value into `enrollments.instructor_id`: the observed staging FK targets `staff`, not `instructors`. Verify an explicit tenant-owned person/staff/instructor mapping; do not infer equivalence from UUID type or display name.
2. Do not remove either instructor column or backfill one from the other without approved mapping evidence and a conflict/quarantine rule. Existing code paths use different references.
3. Existing tables cannot be recreated blindly from historical migration files. Check their complete definitions, dependency relationships and privileges before additive changes.
4. RLS-enabled flags and policy counts are inventory facts, not authorization test results. Browser and privileged commands still require isolated access tests.
5. Keep staging and production conclusions separate. No production compatibility baseline has been established.

## Remaining gates

The read covered relation inventory and targeted column/constraint metadata, not every category in the local inventory script. Additional reviewed evidence is needed for relevant definitions/defaults/checks/indexes, RLS expressions/grants, applied migration versions, source identity mapping, baseline/scenario isolation and recovery. No customer-row reconciliation or instructor data mapping has been authorized or performed.

Raw tool output was not copied into the repository. Project identifiers and connection details are intentionally omitted here. Database reads used the connected Supabase read-only query tool against the explicitly approved staging project; no API keys were requested.

Next deliverable remains an exact additive migration/backfill specification after these gates, followed by isolated synthetic database testing. No route, migration, provider or billing behavior changed in this inspection.