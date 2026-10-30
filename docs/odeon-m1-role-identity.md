# M1 — A person who teaches and learns

## Proposed relationship contract

One person identity can have separate staff/instructor and student roles. On an enrollment, the student reference identifies the learner; instructor references identify the teacher for that enrollment. Being staff does not make the learner their own teacher and does not establish application permissions.

For example, Alex can teach Jordan piano while learning voice from Jordan. Alex has one person record and separate student/staff role records; each lesson enrollment independently selects its learner and teacher. No rule about self-teaching eligibility is introduced by this model.

Staging metadata established that `enrollments.instructor_person_id` targets `people`, whereas `enrollments.instructor_id` targets `staff`. It did not establish how `instructors` role records reconcile with `staff`. Do not write an `instructors.id` into the staff FK or infer role mappings from names.

## Executable local experiment

From `/Users/brunowong/pulse`, run:

```sh
npm run rehearse:academy-roles
```

`/Users/brunowong/pulse/scripts/academy/role-identity-fixture.sql` creates an entirely fictional schema. `/Users/brunowong/pulse/scripts/academy/role-identity-rehearsal.cjs` runs it in cached local PostgreSQL with network disabled, no published ports or host-data mounts and a tmpfs database. It uses an explicit local Docker socket, forbids image pulls and verifies container removal afterward. No application environment files or hosted clients are loaded.

Eight checks cover shared person identity with independent roles, reciprocal teaching/learning on different enrollments, mismatched teacher pairs, wrong ID types, cross-tenant references, partial versus unassigned pairs, referenced-role remapping/deletion and transaction rollback on child failure.

The experiment uses tenant-scoped composite FKs and an all-or-neither check for the two teacher references. The composite teacher FK enforces that both identify the same mapped person/staff role. These are **proposed fictional constraints, not installed application constraints**. Existing staging rows with only one reference must not be rejected or automatically backfilled on this basis. A verified mapping and quarantine/backfill plan are prerequisites to any migration.

## Unresolved before integration

- Choose the authoritative teacher reference and the compatibility window; this experiment does not choose one.
- Verify real person/student/staff/instructor mappings and duplicate-role history without name-based identity merging.
- Decide eligibility, missing-role and archived-role behavior, baseline/scenario isolation and application schema keys.
- Preserve memberships/access, funding relationships and CRM behavior; test them independently. The experiment has no auth tables, grants or RLS and proves no permission boundary.
- Rehearse exact additive migration/backfill against a reviewed schema; do not run this fictional fixture as an application migration.

## Validation

Eight local PostgreSQL relationship checks passed and cleanup removed the container. Existing academy/tenant-selection suites remained **133 passed**, zero failed/skipped; targeted academy ESLint, TypeScript and `git diff --check` passed. This provides partial relationship evidence for M1-01/08 and structural tenant-reference/rollback experiments, not complete M1 database, route or authorization acceptance.