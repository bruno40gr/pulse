# Integrated release checkpoint — November 23, 2026

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