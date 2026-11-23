# Scheduling foundation promotion — November 22, 2026

## Current status — November 23, 2026

The subsequent local implementation adds responsibility configuration,
server-authoritative workspace validation and explicit Admin occurrence/future
replacement. The original gaps below record the November 22 foundation pass;
current coverage is in `docs/server-scheduling-validation.md`.
The agreed School Setup/Staff split and transitional live Staff connection are
documented in `docs/school-setup-and-staff.md`. Duties stay in School Setup;
individual qualifications and availability move to Staff. Nothing is deployed.

## Subsequent product decision: Admin responsibilities

Authoritative decision record:
`/Users/brunowong/pulse/docs/staff-admin-scheduling.md`.
Non-teaching work is Admin; Front desk, Opening/Closing, event work, Sales and
Marketing are configurable responsibilities managed in school onboarding/setup,
not parallel top-level duty types. Admin-only staff are never student-bookable.
Keep existing scheduling intervals; adding 15-minute staff controls is deferred.
The 10-minute rest plus 20-minute Admin split below remains unresolved under
those intervals, not approved finer-time editor behavior. No code in this
foundation pass implemented the responsibility configuration or that split;
the later local pass implements configuration only, never the rest/Admin split.

## Local implementation, not deployed

Isolated snapshot: `/private/tmp/pulse-scheduling-foundation-20261122`, based on
main `777eaa1`. Existing dirty main and prototype worktrees were not edited.

The shared calendar booking decision now enforces School Setup's per-service
maximum teaching level. Calendar enrollment proposals, availability probes and
saved subscriptions carry the selected level. Rescheduling resolves the level
from the student's existing enrollment instead of assuming beginner level.
Legacy records without a maximum conservatively use their configured level list
or level 1, never unlimited qualification. Malformed assignments fail closed.

Regression coverage confirms dated availability replaces the weekly window and
time off subtracts from that replacement. No Scott records were changed: deciding
between 18:00 and 18:30 still requires the authoritative staff choice.

## Not ready for off-Beta promotion yet

- Workspace PUT currently validates structure, permission and revision, not all
  scheduling invariants. Server-authoritative booking validation remains a gate.
- Existing policy reserves a whole half-hour opening for a fixed 10-minute break.
  This pass deliberately leaves it intact. Supporting 10 minutes of protected
  rest plus 20 minutes of admin needs occupancy-aware break enforcement and duty
  editor support; admin must never count as rest.
- Existing booking paths, room/service compatibility, capacity, location,
  enrollment, rescheduling and recurring assignments must remain consistent.
- Explicit assignment replacement for one occurrence versus future recurrence
  still needs implementation/review; availability overrides alone do not provide
  that assignment workflow.
- Review live data mapping, tenant access, concurrent saves, persistence/reload,
  authenticated staff desktop/mobile acceptance, production build and rollback
  before exposing the operational calendar outside Beta.

No migrations, customer writes, deployment, commits or pushes in this pass.
