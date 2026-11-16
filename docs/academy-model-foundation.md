# Storage migration working rules — November 15, 2026

These rules govern how the durable-workspace work below is executed. They exist
because a stale browser regression script cost nearly three hours of repair
across five failed runs before it was reported.

- **Report staleness in 30 seconds, then move on.** When a regression script no
  longer matches the product (renamed fixtures, removed controls, a changed
  storage key, a different nav pattern), say "this script is stale", state what
  changed in one line, and skip it. Do not repair it inside a feature slice.
- **Timebox each slice.** Every storage slice has a stated time budget before it
  starts. When the budget is spent, stop and report what is done, what is left
  and what is blocking — do not continue on momentum.
- **The first time something is stale or blocked, stop and report instead of
  grinding.** Repeatedly re-running a failing check, or widening scope to make it
  pass, is the failure mode to avoid. One diagnostic attempt, then a report.
- **Infrastructure stops are hard stops.** Applying a migration to a hosted
  project, minting a real authenticated staff token, and production cutover each
  require explicit approval. Park at the boundary and ask; never infer consent.

# Staff duties and durable workspace storage — November 14, 2026

- Teacher onboarding includes independent `canCoverFrontDesk` and `canPerformAdmin` eligibility. Admin means scheduled office work, not an account role or permission grant.
- Calendar Front desk / Admin assignments persist with staff, location, optional room/notes, and one-off or weekly recurrence. They remain visible when unavailable-time shading is hidden. Coverage lists identify staff, location and time. Series can be edited or cancelled.
- Saving rechecks all recurring dates against teacher hours/time off, closures, existing duties, teaching and hard resource blocks. Family makeup/reschedule slots also exclude persisted staff occupancy. Optional rooms are not automatically reserved.
- The sample school now uses localStorage, migrating the old sessionStorage snapshot once. It survives fresh browser sessions but remains browser-local, not shared school storage. Storage corruption/quota failures are visible; autosave stops rather than overwriting the saved copy.
- `/api/academy/workspace` adds authenticated tenant-scoped storage through `academy_workspaces` and an atomic revision-checked SQL function. Existing staff read/manage permissions authorize this endpoint; duties do not modify roles. Direct anonymous/authenticated table access is revoked and RLS is enabled. Stale writes return 409.
- A `tenant` workspace selection loads only a provisioned non-sample school snapshot; it will not seed live accounts from demo data. This is a server persistence foundation, not a completed live onboarding/provisioning flow. Other sample-only queues and screens are not converted into production workflows by this change.
- Deployment prerequisite: apply `supabase/migrations/202611140001_academy_workspace.sql`, provision the real school workspace through the live onboarding integration, and validate authenticated multi-user saves against the deployed database. The migration has NOT been applied by this task; database behavior is covered by synthetic route and SQL contract tests, not a live integration test.

# Simplified teacher booking settings — November 14, 2026

- Booking settings show maximum gap between lessons, a disabled four-hour teaching limit, and an Available for self-booking links switch with Yes/No state. Remove override instructions, public-hour inputs, rest-break controls and resource-block explanations.
- Teaching limit and rest duration are fixed school rules (240 and 10 minutes), not configurable overrides. The existing half-hour booking-grid rounding remains unchanged.
- Remove Teacher & room blocks from setup pages; teacher availability/time off stays in the teacher profile. Existing stored blocks remain enforced rather than silently deleted.
- Teacher contact details include optional, free-text pronouns, persisted with the teacher record. The self-booking switch reflects the school setting when no teacher-specific value exists.
- Verified with domain tests and desktop/mobile setup regressions, including pronouns, toggle persistence, fixed controls and removed sections.

# Calendar feedback corrections — November 14, 2026

- Connected enrollment no longer validates teacher names against the legacy sample directory. Required fields and the academy availability adapter still validate before progression/completion. Editing a lesson clears stale submit errors.
- Enrollment grids expand to include proposed early/late times; placement uses that actual grid origin. Selected blocks show service, student, time and teacher, with full details in the title. Changing a teacher retains the date/time.
- Booking preferences retain the selected service/teacher when the date/time becomes unavailable, provide immediate neutral availability feedback, and disable incompatible start-time options. The teacher is prefilled from the column but editable. Error styling remains submit-only.
- Calendar view/range use shared selects; resource filters show names rather than selected counts. Remove Close and the public-rule preview toggle from the staff calendar; suppress group filters without meaningful choices. Unavailable slots use the stronger shared border gray at full opacity. Booking secondary actions precede the bottom-right primary.
- **Current hold policy: no reservation until completion.** Saving an admin draft or sending a family enrollment request does not occupy the calendar. Availability is rechecked on completion. The booking flow states this explicitly. Timed holds remain a separate policy decision: configure under School setup → Scheduling policies, separately for staff drafts and sent requests, with expiry/release/extension and conflict-safe completion; do not expose an inert timer setting as a real reservation guarantee.

# Context-aware calendar booking — November 14, 2026

- Add booking opens cards only, including Single lesson / Free trial. A card opens a separate details screen; Back preserves per-path draft fields and shared calendar date/time. Only the X dismisses the booking screens. Lesson actions are Continue enrollment (shared dark primary) and Send enrollment request.
- Service-column slots open details directly, scoped to that service. Teacher and room slots retain their resource; teacher lessons are limited to assignments, and room lessons to supported services and configured group capacity. Explicit calendar resources stay visible when unavailable rather than silently changing.
- Existing-subscription and send confirmations replace the form with one independently mounted, focus-managed modal. Cancel returns to the unchanged form. Subscription warnings apply to ongoing arrangements; the single/trial entry starts a one-off lesson and leaves pricing to enrollment.
- Events require planned capacity before room choices appear. Event/rehearsal rooms must support a service with the corresponding booking kind (or explicitly support all services); planned capacity and band membership are checked in addition to occupancy. No suitable room means no fallback.
- Demo booking configuration version 2 supplies missing group capacity and explicitly assigns the demo Band room to rehearsal/event services once; subsequent tester edits remain authoritative.
- Verification: domain suite, TypeScript, focused ESLint, and desktop/mobile browser regressions covering contextual entry, two-screen navigation/draft continuity, capacity/suitability, enrollment, family portal, booking policy and calendar controls. Delivery and payments remain simulated.

# Calendar modal resource choices — November 14, 2026

- Booking paths reuse the extracted shared `EntryPathCard` enrollment composition, not parallel radio tiles.
- Lesson services, teachers and rooms are filtered through the same compatibility, occupancy and scheduling rules as saving. A date change expands the relevant schedule even beyond the displayed calendar week. Preserve a valid room; otherwise select the first available room.
- Studio, rehearsal, event and block paths have no service selector. Studio reservations have no teacher selector. New blocks are hard blocks; existing persisted public-only rules remain enforced.
- Missing fields remain neutral until submission. Invalid controls use shared red field borders, accessible invalid state and field messages; no blue validation notice or added explanatory paragraph.
- Coverage: calendar option domain tests and `scripts/security/beta-calendar-options-browser.cjs`, plus booking, enrollment, portal and calendar regressions at desktop/mobile sizes.

# Calendar enrollment handoff — November 14, 2026

- Calendar offers **Continue to enrollment** and **Send enrollment request**. Both persist the same draft keyed by proposal ID. Staff opens the existing enrollment section at step zero with contact/student, service, cadence, teacher, room and time prefilled; no modal payment stepper, special origin banner or automatic return journey.
- À-la-carte and ongoing proposals reuse existing pricing/payment controls. New calendar lessons remain 30/60 minutes. Completion preserves per-lesson minor-unit pricing, payer, paid/unpaid decision and room/service identity.
- The student + service/program active-subscription warning allows an intentional additional subscription. Matching enrollments created independently after the proposal require review; staff may explicitly continue, but nothing is merged or attached automatically.
- Sending identifies the family recipient and previews the local-only delivery. Resend is idempotent. Staff and family use one draft and completion command with shared completed-by and enrollment result IDs. Reopening a completed entry cannot book/charge again.
- Sending does not hold the time. Completion rechecks current availability, room and event conflicts. Ongoing proposals validate a rolling 52-week horizon, not an indefinite guarantee. Invalid proposals stay incomplete.
- Local prototype only: shared same-tab store with session reload backup, fictional payments and message delivery. No production delivery, database transaction, cross-device synchronization or server authorization is implied.
- Regression coverage includes shared identity/resend, family scope, paid/unpaid results, accepted additional subscriptions, newly matching subscription review and current-state conflicts. Browser flows are in `scripts/security/beta-calendar-enrollment-browser.cjs` and `scripts/security/beta-calendar-enrollment-portal-browser.cjs` (1440/390px). This supersedes the previous direct unpaid calendar-lesson behavior below.

# Connected calendar booking mocks — November 14, 2026

- Calendar drawing and **Add booking** mount the same portaled, fixed-height
  progressive dialog. Drawing prefills date/time/duration and the column resource;
  lesson durations normalize to 30/60 minutes, all other durations use 30-minute
  increments. The dialog scrolls internally without changing its shell size.
- Lessons save a tracked enrollment proposal, never a zero-price booking. Studio, rehearsal
  and event bookings use additive `FamilyPreviewData.calendarBookings` records;
  participants/bands are optional, with a deduplicated roster snapshot and one
  exclusive room reservation. These records do not create enrollments or payments.
- Hard and public-only blocks live in additive setup `resourceBlocks` records, so
  Calendar and School Setup show the same saved exclusions. Weekly blocks have an
  explicit end date and are checked on every date before save. Existing bookings
  are never moved/cancelled to make a block fit. Teacher time off remains in the
  teacher's own setup record and is evaluated with dated/weekly availability.
- Policies expose academy scheduling defaults and teacher overrides: maximum
  120-minute gaps, 240 teaching minutes before rest, and a 10-minute rest that
  reserves a **whole 30-minute slot**. A rest gap must contain that full snapped
  slot. Explicit separate availability shifts are evaluated separately. Public
  booking hours and veto blocks narrow availability; they never open closed days.
- `academy-calendar-booking.ts` centralizes duration-aware checks for the new
  modal, drawing, save and calendar rescheduling choices: teacher hours/time off,
  assignments/location, room suitability/capacity/exclusive occupancy, participant
  conflicts, closures, resource blocks, gaps and rest. Hidden overlays do not change
  those checks. The calendar can preview public restrictions without publishing a
  public booking endpoint.
- Existing fictional appointments are retained, including legacy 45-minute
  lessons and timetable-policy exceptions. New demo services/configuration are
  added by an idempotent migration; tester records/settings are not overwritten.
  No automatic timetable compaction or break insertion is performed.
- Scope: local session persistence only. No production database/API, payment,
  concurrency guard, public checkout, or universal migration of every legacy
  enrollment/makeup flow to this availability engine. Recurrence in the new modal
  is currently for blocks only; lesson cadence is chosen through enrollment.

- Verification: `scripts/academy/calendar-booking-policy.test.cjs` covers block,
  duration, recurrence, roster, capacity, public hours, gap and rounded-break rules.
  Browser coverage lives in `beta-booking-policy-browser.cjs` and
  `beta-setup-scheduling-browser.cjs`, plus refreshed calendar controls/hub checks.

# Academy model foundation — November 14, 2026

## Scope and decisions

Local fictional Beta/demo implementation, not a production schema migration or
payment provider integration. Opus is a scenario/density reference, not the target
domain. Account holder and payer separation already exists and must be preserved.
Academy-defined services/progression remain the target; Headliner's numeric levels
are not a universal academy constraint.

Attendance outcomes: **Present, No-show, Excused absence**. Missing attendance is
unmarked. Session cancellation is separate; attendance alone never creates credit.

## Implemented in this pass

- Explicit series and occurrence IDs survive the fictional seed adapter and
  recurrence expansion. Calendar projections aggregate a roster only by explicit
  occurrence identity, never by name/time. Disagreeing assignments fail visibly.
- Calendar whole-session move/cancel applies to all participants. Family
  participant-only moves detach occurrence identity and preserve classmates.
- Per-participant attendance controls reuse the shared Select in the calendar
  inspector, with saved local state. Inspector height respects its anchor.
- Confirmed enrollment remains active when initial payment is deferred. Its
  initial payment state is recorded independently; it is not an invoice balance.
- Subscription snapshots record effective date, recorded time, actor and reason.
  State, level/duration and payer/collection changes preserve prior terms.
  Recurrence generation respects effective hold/resume/end states (end exclusive).
- Separate failed/successful payment attempts, receipts with invoice allocations,
  and allocation-referenced refunds. Existing pay/partial-pay/refund actions use
  the ledger for newly recorded payments. Failed attempts do not modify invoices.
  Explicit attempt/refund IDs support identical replay and reject conflicting reuse.
- Additive model version 3 retains the existing session-storage key and tester
  records. No resets or inferred historical grouping. Existing paid invoices do
  not receive invented provider/payment history.

## Remaining work — do not describe the whole domain as completed

### Density and adapter follow-up — November 14, 2026

Calendar interaction follow-up:
- Calendar student actions now open the existing student workspace V3 in place
  with shared data/makeup mutations; closing retains the calendar route and filters.
- Teacher/service/room perspectives are visible segmented controls. Staff, group,
  room and service filters allow multiple shared-checkbox selections (OR within
  each filter, AND between filters). Date navigation includes a native date picker.
- Attendance uses direct outcome toggles, not a select. Cancelled blocks use a
  dashed border and struck-through heading without adding a calendar text row.
- Empty-slot selection uses half-hour targets, including pointer drawing; booking
  opens the canonical portaled Modal with service, time and duration fields.
  Existing band programs accept 30-minute multiples through enrollment validation
  and projection. A generic configurable-service scheduling engine remains open.
- Teacher headers use the canonical Avatar with configured image fields and an
  initials fallback. The fictional teacher seed does not contain portrait photos.
- Identity hues expanded within existing non-status hue roles. Ages are not added
  to calendar names, and the family-calendar explanatory paragraph was removed.
- Follow-up verification: 189 focused tests; TypeScript, focused ESLint and diff
  checks; desktop/mobile profile/filters/date/modal, attendance, rescheduling,
  booking/cancellation and density/migration browser checks. Pointer drag is
  additionally exercised at desktop width; touch selection uses half-hour taps.

- Fictional population expanded to 167 students, 190 enrollments, 115 families,
  15 staff, 174 weekly sessions and 13 existing rooms. Original IDs/scenarios
  remain intact. Mixed private services run every weekday, evenings through
  20:30, plus Saturday lessons and classes. Weekly session counts Monday–Saturday:
  44, 28, 40, 16, 17, 29. This approximates density, not an imported timetable.
- Dataset version 2 appends new fictional identities and their connected records
  to saved browser state once. Existing edits/deletions and makeup state are
  retained. New records are not scheduled around arbitrary tester overrides;
  those can still require manual conflict review. No storage reset is performed.
- Band workspace groups project existing band enrollment series and member IDs.
  Calendar uses their existing occurrences, avoiding duplicate occupancy, and
  preserves group filtering. Arbitrary group schedule edits still need a full
  authoritative shared-series mutation path; this is not a normalized backend.
- Indexed enrollment ownership in calendar/teaching adapters, indexed recurrence
  presence, and date-scoped makeup conflicts replace nested whole-directory scans.
  Fictional staff metadata is cached for legacy makeup availability. Teacher
  substitutions and cancellations now affect teaching load correctly. Student
  conflicts are checked across teachers. Full rooms return no available room,
  not an occupied fallback. Calendar draft completion rejects missing room.
- Shared calendar grid has an opt-in initial teaching-time scroll; default
  callers are unchanged. Academy opens half an hour before its first booking
  instead of showing six empty morning hours. All configured resource columns
  remain available, including unused ones.
- Staff enrollment availability now includes expanded future recurrence, not
  only the original September/October records. Broader API/backend wiring remains
  out of scope for this local simulation pass; no operational endpoints changed.
- Validation: 179 academy/family tests, TypeScript and focused lint; desktop/mobile
  calendar, family rescheduling, roster/attendance, density/migration browser runs;
  card/deferred-payment enrollment and band completion. New density checks cover
  unique IDs, relational integrity, teacher/room/student conflicts and capacity.
  Local synthetic 52-week expansion measured ~17 ms and calendar projection ~11 ms
  in one run, not a production API latency or end-to-end benchmark.

- Persisted normalized session/participant, subscription revision and payment
  tables/APIs, with transactional constraints, tenancy and authorization checks.
  The current lesson records remain compatibility projections in browser state.
- Explicit subscription replacement operations and links; complete history for
  recurring schedule changes; history UI and future-effective revision editing.
  Versioned pricing must feed billing calculations, not merely snapshots.
- Full academy-configured progression/catalog propagation. Legacy 1–3 unions and
  prototype selectors still exist; this pass does not pretend they are generic.
- Third-party payer identity integration throughout completion projections,
  respecting the existing canonical design rather than redefining it.
- Separate participant withdrawal/cancellation from attendance. The pre-existing
  family absence workflow still stores a compatibility `Absent` status alongside
  the new `Excused absence` attendance field.
- Finish bidirectional band group schedule editing against authoritative series.
- Provider-backed asynchronous attempt lifecycle, request keys on all UI payment
  actions, allocation changes for invoice consolidation, partial refund UX and
  reconciliation. Legacy paid invoices retain their existing refund summary.
- Broaden fictional lifecycle/payment/third-party-payer scenarios as ownership
  gaps close. No private CSV identities have been imported.

## Verification

New domain regressions cover shared rosters/recurrence, session changes,
participant attendance/isolation, effective hold/resume/end, failed attempts,
partial settlement, replay protection, refunds and additive migration.
Existing academy/family suites and local desktop/mobile browser checks are run
alongside the new session attendance runner. These are simulation checks, not
production deployment, authorization or real charge evidence.