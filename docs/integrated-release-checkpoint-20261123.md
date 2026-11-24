# Integrated release checkpoint — November 23, 2026

Continuation: `docs/integrated-production-readiness-20261123.md` records the
local auth-source migration, duration reader fix, isolated PostgreSQL rehearsal,
1,150 passing tests, list/detail/PATCH subscription parity, synthetic desktop/mobile
card rendering and remaining provisioning/production-rendering/recovery blockers.
It is not authorization to migrate or promote production.

## Current decision and repair status — November 23 Pacific / November 24 UTC

The agreed workflow is now `docs/staging-and-release-workflow.md`. It supersedes
blanket hosted-staging/Preview acceptance requirements below, not the production
compatibility, authorization, migration, backup or rollback gates. Stop rebuilding
staging or asking Bruno to debug a fictional school. No production promotion is
authorized by this decision.

### Staff repair on the existing release line

- Operational Staff now opens a work-profile dialog in place, not a separate
  prototype directory. Profiles use the existing instructor/person identity;
  reads do not create data. Unlinked legacy/duplicate profiles fail explicitly.
- Narrow work-profile saves reuse tenant permissions, scheduling validation and
  revision-checked workspace persistence; contact identity fields cannot change.
- Sample Staff follows updated input data. Beta/operational dialogs share the
  canonical dialog stack, avoiding nested focus/inertness conflicts.
- Earlier staging-connected local browser evidence: save returned HTTP 200,
  revision 4; fresh desktop (1440px) and mobile (390px) pages reopened saved Monday
  10:00–11:00 availability, retained all five operational Staff entries, supported
  nested dialogs, and had no page overflow. This is limited staging persistence
  evidence, **not production acceptance**. It preceded the workflow decision.
- The first save browser script stopped on an ambiguous Close selector after
  saving; a separate scoped-selector desktop/mobile reopen check passed.
- Evidence: `/private/tmp/pulse-staff-persisted-check.log`,
  `/private/tmp/pulse-staff-reopen-check.log`,
  `/private/tmp/pulse-staff-reopen-{1440,390}.png`.
- Last complete local suite: 1,144 passing tests. New route coverage includes
  identity protection, permissions, stale revision/CAS and preserving colleagues.
  These tests do not establish production schema availability.
- Final follow-up: TypeScript and targeted lint passed; refreshed manifest hashes
  verify 47 files. Read-only browser reruns at 1440px and 390px passed after the
  header save action change. All API writes were intercepted/denied; the unrelated
  account-claim reminder GET was locally suppressed so it did not cover the Staff
  dialog. No claim/account state changed. Evidence:
  `/private/tmp/pulse-staff-final-readonly-browser.log` and
  `/private/tmp/pulse-staff-repair-{suite,types,lint}.log`.

### Enforced read-only production compatibility findings

Inspected the explicitly targeted production project `jbrntsxmibfldocsuslt` using
the Supabase read-only query endpoint (no service-key substitution). School tenant
`00000000-0000-0000-0000-000000000001`:

- `public.academy_workspaces` and
  `public.save_academy_workspace(uuid,uuid,bigint,jsonb)` are absent.
  The Staff work-profile repair cannot be enabled as working production editing
  without a reviewed schema/provisioning plan. Do not deploy an exposed dead end.
- Production has 523 enrollment rows, 331 with active/pending status; 221 rows
  have source subscription IDs across 186 students. Source-linked rows have zero
  unresolved teacher identities and zero references to former staff. These are
  aggregate identity checks, not browser/rendering or complete source reconciliation.
- All 22 instructor rows have person links, with 22 distinct people.
- Memberships include 9 active (legacy disabled), 2 invited (legacy enabled),
  and 7 unclaimed (legacy enabled). The existing API allows eligible legacy
  invited/unclaimed sessions, while the proposed forward SQL requires active
  membership. Resolve this policy mismatch before release; do not reset accounts
  or silently mark memberships active to make a test pass.
- Production enrollments expose both `instructor_id` and
  `instructor_person_id`. Schema/data compatibility must use explicit identities,
  not assume these references are interchangeable.

No production writes, deployments, migrations, imports, authentication changes or
configuration changes were performed. Staging's zero subscriptions are not a
production data repair requirement. The next release work is exact schema/actor
policy/provisioning review, real subscription-reader verification and bounded
promotion/rollback preparation—not staging reconstruction.

### Remaining bounded release work (not promotion approval)

1. Review the complete integrated diff; do not mistake this repair checkpoint for
   approval of all accumulated UI/subscription/communications changes.
2. Specify provisioning for a school with no workspace: real existing instructor
   identities, no sample records or guessed qualifications/hours, exact additive
   schema order and preservation of existing normalized subscriptions. Until this
   is implemented and verified, do not expose work-profile editing in production.
3. Reconcile database actor checks with the approved API's personal/legacy policy.
   Preserve tenant and legacy-enabled restrictions; rehearse rejection of disabled,
   suspended, deactivated and foreign actors in an isolated database. Do not loosen
   authentication or change users merely to pass acceptance.
4. Verify the production subscription reader against current row contracts and
   review real rendering through approved read-only access. Aggregate counts alone
   do not verify contact cards or promise that every legacy active row is current.
5. Present exact deployment/migration scope and recovery plan for explicit approval.
   No main merge, production push, migration or hosting change is authorized yet.

## Scope and release boundary

Review branch: `release/integrated-staff-subscriptions-20261123`.
Base: `777eaa179e5bf723d0194e9120839e84f07b057e`.
The first checkpoint, `bf05621`, preserves all 88 previously changed/untracked
UI, subscription, family, communications and tenant-safety files. These are
reviewable source checkpoints, not authorization to deploy every feature.

Scheduling was selectively reconciled from
`/private/tmp/pulse-scheduling-foundation-20261122`, not copied wholesale.
The contact panel was three-way merged to preserve newer cancellation and
tenant-cache safety. Four modified dependencies and two new dependencies/tests
missing from the source manifest were included. `server-scheduling-files.json`
records the reconciled file hashes, including the forward migration.

`TeachersStaffDirectory.tsx` was explicitly checked: it is not tracked or present
in the destination, and no destination TSX references it. No deletion was staged
based merely on its absence in the snapshot.

The November 22 card-summary snapshot's release allowlists were compared with
the checkout. Seven differing allowlisted files contain subsequent subscription,
test or documentation work; they were retained rather than overwritten. This
comparison is not proof of authenticated production acceptance.

## Backups and recovery

Backup: `/Users/brunowong/pulse-backups/integrated-release-20261123-084557`.
Includes all Git refs, staged/working patches, SHA256-verified recovery of all 88
changed/untracked files, and source archives of both scheduling and last-release
snapshots. Dependencies, build output and environment files are excluded.
A second all-refs bundle is under
`/Users/brunowong/odeon-private/pulse-release-checkpoint-20261123-084557`.
Both locations are on this machine, not offsite disaster recovery.

The recovery drill restored refs, applied the tracked patch and verified every
archived working file against its recorded SHA256. Nothing was deleted.

## Deployment inspection

Vercel CLI confirmed project `pulse` is Git-connected to `bruno40gr/pulse`, with
production branch `main`. No GitHub Actions workflow or active local push hook
was found. A release-branch push may trigger Vercel preview automation; it is not
a production promotion. Do not push this checkpoint to `main` yet.

The canonical production alias was independently inspected read-only and resolved
to READY deployment `dpl_9RET9mWoyHGsYLX6FnkKhZfqqT9s`, created November 22, 2026.
No production code, environment settings, customer data or migrations were changed.
The documented November 23 subscription repair was not independently reverified
or rerun. A source push does not apply that repair.

## Validation of the combined source

- TypeScript: passed.
- Full security/regression suite: **1,137 passed, zero failures**.
- Updated one stale modal contract assertion to require hiding the result count
  until contact/AI loading settles, preserving the skeleton-first contract.
- Scheduling targeted lint: zero errors, three existing operational Staff/contact
  warnings. Updated test scripts also lint cleanly.
- Optimized build: passed in an isolated source copy with synthetic Supabase/CRM
  configuration. No production secrets or production build guard were validated.
- Desktop/mobile fictional browser checks: passed at 1440px and 390px, including
  setup redirect, profile/availability save, duties persistence and assignment.
  These used explicit loopback development review, without a forged staff session.
- Disposable PostgreSQL: scheduling concurrent-first-save, stale revision,
  tenant-actor isolation, browser-role denial and reload passed. The test applies
  the original migration followed by the new forward migration and rejects a
  negative revision before inserting workspace data.
- Disposable PostgreSQL subscription repair/rollback: atomicity, preserved
  history, distinct subscriptions, replay, stale-state and tenant/inactive
  rejection passed. This is not execution of the production repair.
- Subscription offline coverage retains separate teachers per enrollment,
  explicit instrument/level/duration/status and absent unknown values.

Evidence: `/private/tmp/pulse-integrated-{types,tests,lint,build,browser}.log`,
`/private/tmp/pulse-integrated-scheduling-postgres.log` and
`/private/tmp/pulse-integrated-subscriptions-postgres.log`.

## Database and promotion gates

The original `202611140001_academy_workspace.sql` is unchanged from the base.
Actor/revision hardening is an explicit forward migration:
`202611230002_academy_workspace_actor_validation.sql`. Already-provisioned schools
must receive that reviewed migration; replaying the historical migration is not
an upgrade strategy. No migrations have been applied by this checkpoint.

Scheduling remains behind existing Beta routing and tenant permissions. The
operational Staff shortcut requires unique explicit person/workspace identity;
it does not seed sample records or grant access around Beta permissions.

Before promotion: genuine authenticated staff acceptance, production identity
mapping, exact migration/configuration scope, real persisted subscription review,
and an application/database rollback rehearsal remain blocking. The disposable
repair rollback test and source recovery drill do not replace that rehearsal.
Do not blindly run all pending migrations or subscription imports.

For application rollback, retain the current canonical deployment and verified
source archive; review alias restoration with an authorized operator. Database
rollback must use the migration-specific plan and actual pre-change backup,
not a source revert. No production rollback was attempted.