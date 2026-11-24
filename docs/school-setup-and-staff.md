# School Setup, Staff and scheduling ownership

Agreed scope: November 23, 2026. Implemented in the isolated scheduling snapshot;
not deployed and not approval to remove the Beta boundary.

## Product ownership

| Surface | Owns |
| --- | --- |
| School Setup → Services / Curriculum | School offerings, levels and curriculum |
| School Setup → Administrative time | Shared duties catalogue: add, rename, archive |
| School Setup → Policies / Calendar | School-wide scheduling rules and closures |
| Main app → Staff → staff profile → Qualifications & availability | Instruments/services and maximum teaching level for each, working locations, availability, time off and administrative-work eligibility |
| Staff profile → Assign administrative time | Person-first entry to the same assignment form used by Calendar |
| Calendar | Actual teaching/Admin assignments, recurrence and occurrence/future replacement |

Individual staff editing no longer belongs in School Setup. The former
`section=teachers` URL redirects to Staff, retaining tenant context. Administrative
time remains a standalone School Setup section at `section=adminResponsibilities`.
The internal `setup.teachers` and `setup.adminResponsibilities` keys remain stable:
moving an editor does not create a second directory or require a data migration.

## Preserved behavior

- Reuse `TeacherEditor` and `TeacherSchedule`, including per-instrument maximum
  levels, contact fields, locations, time off and scheduling overrides. Keep the
  existing Staff table, contact editing, students and communication actions.
- Availability is not a booking. Work eligibility is not an app role. An Admin
  assignment reserves no room unless explicitly selected.
- Removed duties are archived, not deleted; old assignment labels are retained.
- No automatic workload allocation or parallel staff scheduling grid.
- Half-hour staff assignment controls and mandatory protected breaks remain.
  The unresolved 10-minute rest + 20-minute Admin split is deferred.

## Availability scope

The grid is titled Availability. Before editing, choose **This week only** or
**This week and following weeks, until the next saved change**. Both use existing
effective-dated `availabilityWeeks` persistence. A temporary week adds a restore
boundary for the following Monday unless one already exists. Earlier weeks and
later saved boundaries survive. A date selected in the dialog determines the
edited week; unrelated dated exceptions are retained. Time off is separately dated.

Before committing a staff edit, the shared scheduling validator checks that
person's persisted teaching/Admin assignments. Conflicts are reported with record
and date, without moving/cancelling bookings. Workspace PUT remains authoritative
for the whole school, including revision compare-and-swap. Client preflight is
not a substitute for server validation.

## Live identity boundary

**November 23 continuation supersedes the transitional shortcut below:**
operational Staff now uses an in-place work-profile dialog and tenant-scoped
API. Legacy live prototype links redirect to operational Staff. The older
`/odeon-demo` description is historical, not the current release contract.
Missing workspace storage still fails closed. See
`integrated-production-readiness-20261123.md` for provisioning constraints.

Operational editing is default-off pending authoritative real-school scheduling
reconciliation. The public build flag `NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE`
requires explicit `true`; the server flag `ENABLE_STAFF_WORK_PROFILE=false` vetoes
API access. Do not enable these under an approval to continue development.

The operational `/dashboard/staff` contact panel links into the existing
tenant-workspace Staff work-profile experience. It requires a unique, explicit
`teacher.values.personId` match. Never match live people by name, assume a contact
ID equals a scheduling ID, or seed fictional teachers into a tenant. Missing or
ambiguous links show a blocking message; absent workspaces fail closed.

This is a transitional connection to `/odeon-demo?screen=staff&tenant=…&person=…`,
not completed removal of the Beta boundary or a new production staff datastore.
Review routing and permissions against the current live release before promotion.
The snapshot predates that release and is not a deployable replacement for it.

## Acceptance and release gates

- November 23 local evidence: 51 selected offline tests pass; TypeScript passes;
  targeted ESLint has zero errors and three existing warnings in operational
  Staff/contact files. Disposable PostgreSQL confirms concurrent-first-save,
  stale-revision, tenant-actor, browser-role and persistence/reload behavior.
- Optimized build passes with loopback-only synthetic Supabase/CRM settings.
  This is not validation of production secrets or production deployment.
- Local browser checks at 1440px/390px: setup redirect, existing Staff profile,
  preserved qualification controls, staff edit save, duties add/remove/rename and
  reload, person-first assignment and Calendar entry. Sample storage is not proof
  of genuine authenticated staff acceptance.
- Offline tests cover effective-week restoration, later boundaries, explicit
  identity matching and rejection of availability changes over teaching work.
- Existing tests cover Admin-only exclusion from teaching, recurrence replacement,
  break protection, tenant access, revision conflicts and archived responsibilities.
- Before release: real staff/person/workspace mapping, authoritative enrollment
  levels through Contacts (unknown stays absent), shared group/event roster
  storage, authenticated desktop/mobile booking/reschedule/makeup workflows,
  production-environment build, reviewed deployment manifest and rollback rehearsal.

See `docs/server-scheduling-validation.md` for authoritative scheduling coverage
and `docs/scheduling-foundation-promotion.md` for promotion constraints.