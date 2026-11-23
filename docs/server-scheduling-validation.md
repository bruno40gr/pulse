# Server scheduling validation and Admin handling

Implemented locally in `/private/tmp/pulse-scheduling-foundation-20261122`.
No deployment or production workspace migration applied by this implementation.

## Implemented

- Staff owns individual qualifications, availability, time off and administrative
  eligibility; the existing staff profile opens the reused teacher editor.
  School Setup retains Administrative time → Configure for the shared duties list.
  Former setup staff URLs redirect to Staff. Person-first assignment reuses the
  Calendar form. See `docs/school-setup-and-staff.md` for ownership and live mapping.
- Availability supports a temporary week or effective-forward changes, preserving
  previous weeks, later boundaries and unrelated dated exceptions. Client staff
  preflight rejects affected assignments; workspace PUT still checks the school.

- Workspace PUT loads the tenant's persisted revision, validates the entire proposed
  scheduling snapshot server-side, then calls the revision-locking save RPC. A race
  during validation still loses the RPC compare-and-swap and returns 409.
- Server validation reconstructs lesson and booking occupancy; checks explicit
  levels, staff qualification, availability/date overrides/time off, locations,
  closures, rooms/service compatibility, shared-session capacity and conflicts.
- Unsupported group roster assignments fail closed; no browser-provided conflict
  verdict or occurrence projection is trusted. Bounded recurrence and size limits
  reject unbounded requests. Recurring lessons have at least a rolling-year check.
- New non-teaching assignments use Admin with school-configured responsibilities.
  Responsibilities can be renamed or disabled; stored assignment labels preserve
  historical meaning, and deletion is rejected by the server.
- Admin-only staff can have an empty teaching-assignment list without becoming
  lesson-bookable. Admin scheduling does not confer application permissions.
- Admin occupies staff time and optionally an explicitly selected room. Admin
  cannot satisfy protected rest. Teaching still requires a half-hour free slot
  for the fixed ten-minute break after four hours; no finer timing UI is added.
- Explicit replacement actions split one occurrence or the future series tail.
  Exclusion dates preserve the original record and avoid duplicate occupancy.
- Workspace SQL now checks active tenant membership for the acting member before
  a save. It is service-only; browser roles cannot read/write snapshots directly.

## Validation and evidence

- 44 focused scheduling/storage/rescheduling tests passed.
- Disposable PostgreSQL: concurrent first saves yield exactly one winner; stale
  revisions fail; foreign tenant actors and browser roles are denied; reload works.
- TypeScript and targeted ESLint passed.
- Optimized Next.js build passed with loopback-only synthetic Supabase and CRM
  aliases. This is not a production-environment configuration verification.
- Signed fictional-session browser checks passed at 1440px and 390px: responsibility
  creation/reload, Admin category, retained half-hour controls and optional room.
  Uses loopback dummy Supabase settings, not production credentials or records.
- Logs: `/private/tmp/pulse-scheduling-server-{tests,types,lint,postgres,browser}.log`.
- Full snapshot suite: 1068/1086 passed. Sixteen failures are stale Gmail fixtures
  in this older snapshot; the current live-release Gmail fixture passes. Another
  is a Tabs color-contract failure also reproduced in the live snapshot. The last
  requires the sibling website repository; all 13 website tests pass when its
  actual path is supplied. Do not call the full suite green.

## Remaining promotion gates

- The isolated snapshot predates the last live release. Apply only reviewed,
  allowlisted scheduling changes atop that release; do not deploy this snapshot.
- Group/event queue storage remains separate and browser-owned. Consolidate its
  authoritative tenant storage and occupancy before claiming full calendar coverage.
- Provision/migrate real School Setup identities and schedules deliberately; a
  generic snapshot is not an authoritative production people directory. API
  qualification validation is authoritative for the workspace model, not yet an
  adapter to production enrollment tables.
- Future/historical enrollment state changes require a dedicated audited workflow;
  the workspace guard rejects silent level reductions but is not that workflow.
- Legacy Front desk records are retained; migrate or explicitly replace them into
  configured Admin responsibilities before broader operational use.
- Complete live tenant/authenticated acceptance and production build review,
  migration/rollback review, then stage and promote. No customer schedules were
  inferred, imported or rewritten here.