# Current subscription teacher reconciliation — November 22, 2026

## Verified incident

Production project: `jbrntsxmibfldocsuslt`; school tenant:
`00000000-0000-0000-0000-000000000001`.

Vikram Abhilash's source client ID is
`db18a642-6997-4003-b0a0-fe0fe60a3e25`. His stored enrollment
`e1de8f92-26d0-4f7f-80c5-e5caceec3cd7` points to Bridget Pique,
whose person record is already marked `staff_status: sunset`.
The November 19 subscription export identifies the same source client ID with
Isaias W Pallib, Active, Piano - Level 2 (30 min). Isaias Pallib has an existing
production instructor identity; do not create another person for the middle name.

Read-only production queries found 40 active-status enrollments pointing to
Bridget and 6 pointing to Julia Janecek, also sunset. These counts describe stored
rows, not verified current subscriptions. All 302 stored enrollments have no
`custom_fields.subscription_id`; only 12 have an imported status field.

Source file: `/Users/brunowong/Downloads/subscriptions_report_November_19,_2026_7_47_AM_PST.csv`.
It contains 221 Active/Pending rows across 186 source clients; 18 clients have
multiple distinct primary staff names. Current subscription IDs are present and
unique. This is a November 19 snapshot, not proof that nothing changed since then.

## Root causes found in code

- Contacts resolved enrollment teacher identities without selecting/checking staff
  lifecycle metadata, allowing a sunset teacher to appear current.
- Contacts fell back to legacy imported teacher strings when the identity was
  unavailable. Such strings are not evidence of current assignments.
- Existing-student CSV import selects one enrollment by student ID with
  `.single()`, not by source subscription ID. It cannot safely reconcile multiple
  subscriptions and can overwrite a lone enrollment with successive source rows.
- The subscription parser does not preserve source subscription ID, source staff
  ID, subscription status, or the explicit level in Service Name.

Do not rerun the existing Contacts importer as a repair.

## Local changes, not deployed

- Shared subscription service titles now use H2, including live and Beta callers.
- Current teacher names require a resolved teacher identity and exclude sunset,
  inactive, ended, and archived staff. Historical text no longer restores those
  names through the Contacts instructor fallback.
- An unresolved current teacher displays “Current teacher needs verification”.
  This prevents a misleading name; it does not repair the underlying assignment.
- API regression verifies all enrollment teacher rows survive projection, including
  two current teachers for a student, and no historical fallback for a sunset row.
- Existing renderer shows every returned enrollment as its own card. Co-teaching
  within one subscription still has no verified source/model contract; the export
  only supplies Primary Staff. Do not claim complete multi-teacher reconciliation.

Validation: 21 focused tests, TypeScript, targeted lint, and local intercepted
browser checks at 1440px/390px passed. Evidence:
`/private/tmp/pulse-teacher-correction-{tests,types,lint,browser}.log`.

## Required repair before claiming current subscription accuracy

1. Match clients by exact tenant-scoped source client ID, rejecting missing or
   duplicate identities. Match subscriptions by source subscription ID, not names,
   plan wording, row order, or student ID alone.
2. Produce a dry-run for the full export, resolving existing teacher IDs using
   source identity/confirmed aliases. Flag ambiguous and sunset targets.
3. Keep source snapshot time, status, service name/level, subscription ID and staff
   ID. Preserve separate subscriptions and all their current teachers.
4. Preserve legacy attendance and historical teacher evidence. Explicitly decide
   whether old enrollment rows become historical or receive versioned assignments;
   do not attach old attendance to a replacement teacher by overwriting it.
5. Apply only reviewed, tenant-scoped, concurrency-checked changes with backup and
   rollback, then verify Vikram, multi-teacher students and former-staff references
   against persisted production data.

## Production application — November 22, 2026 Pacific / November 23 UTC

Run `nov19-subscription-repair-v1` applied at `2026-11-23T04:33:41.770699Z`.
Production was explicitly targeted through the authorized Supabase connector.

- Source SHA256: `dc6be22da0c6808234aa4e01baf818271c052e92058bb7e071bac939844b1b52`.
- All 221 staged rows / 186 clients matched normalized source MD5
  `b1fd43ab74a89f92b727e98e6cddc475` immediately before application.
- Original 302-enrollment fingerprint: `8a0efa6d495d38aa7999dfe366b05dff`.
- Inserted 221 source-linked subscriptions; marked 192 represented legacy
  enrollments ended. All original enrollment preimages are retained in the
  service-only run backup. No original teacher/attendance evidence changed.
- Added one student role to Drew Johnson's existing person
  `2cee918e-72f0-4956-a3d4-1fae3f63a910`; no account was guessed.
- Verified zero source/persisted identity, teacher, status, service, plan, level
  or duration mismatches. All 18 multi-teacher clients retain separate subscriptions.
- Vikram now has active Piano Level 2 with Isaias Pallib, subscription
  `5d657001-9966-4f3c-ab86-7bb0f7add49b`; his Bridget enrollment remains ended history.
- No repaired subscription points to sunset/inactive staff. **21 other legacy
  active/pending rows still point to former staff** outside the represented export
  scope. They were deliberately not ended without authoritative source evidence.
- Post-apply fingerprint: `edb960755acf37e553744df1edc04f0c`.

Executable rollback: `/Users/brunowong/pulse/scripts/security/rollback-subscription-reconciliation.sql`.
On an authorized production PostgreSQL session, set
`SET pulse.reconciliation_run = 'nov19-subscription-repair-v1';` then execute the
script with `ON_ERROR_STOP`. It refuses any changed post-repair enrollment state,
restores legacy status/custom fields, removes this run's inserted subscriptions
and only its newly created student roles, then verifies the original fingerprint.
Foreign-key conflicts fail the entire transaction rather than cascade deletion.
Do not use the local environment to run this against production.

Latest validation: 15 focused tests, TypeScript and targeted lint passed; isolated
PostgreSQL verified history, separate subscriptions, replay, stale state, missing
student creation, tenant/inactive rejection, failure atomicity and guarded rollback.
Evidence: `/private/tmp/pulse-reconciliation-{tests,postgres,types,lint}.log`.
No deployment, commit or push in this pass. Scheduling promotion remains gated.

Local `.env.local` targets a different Supabase project (`xpnygavujqmzkdmcktdm`),
not production. It must not be used as production verification. Production evidence
above came from explicitly targeted management queries. Vercel's env
pull redacts production secrets; do not substitute another project's credentials.