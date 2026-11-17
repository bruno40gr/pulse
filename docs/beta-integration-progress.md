# Beta integration progress — November 13, 2026

## Reschedule clarity, and a plumbing audit — November 17, 2026

- **Nothing is preselected** in a reschedule, and the two purple states no longer look
alike. The lesson being moved keeps its student identity colour with a dashed border and
reduced weight; the chosen replacement is solid with an inset ring. Blank cells became
flat grey "unavailable" cells, so only real options look clickable.
- **A lesson is no longer offered as a move onto itself** — the origin slot is excluded
(open slots fell from 21 to 20 on the sample week).
- **A test caught a real regression**: `calendar-appearance` requires family and reference
lessons to keep the student identity colour. Making them neutral broke that contract; the
two states are now separated by border weight instead of by removing identity.

### Plumbing audit

- Storage shape is unchanged: one workspace document (`odeon:app-sample:v2`, or the tenant
record through `/api/academy/workspace`) holding `{ snapshot, setup }`. No new keys, no
second store, and the new setup areas travel inside `setup` automatically.
- **Found and fixed a genuine gap**: a workspace saved before today has no `groupTypes` or
`eventTypes`, and setup read `data[id].length`, so those users would have hit a render
crash. `withPackagedOfferings` now fills only the missing areas on both load paths, and
the section list reads defensively.
- Verified by stripping both areas out of a saved workspace, reloading, opening setup and
saving: no crash, both sections present, and the stored document came back with 10 areas,
3 group types and 6 event types.
- `engineeringLevel` sits on the teacher record and `participantIds` on the booking, so
both persist through the same document. The reschedule work is read-only and writes
nothing.


## Availability reads as an invitation, not a booking — November 17, 2026

- **The reschedule calendar keeps the full week** so a parent can follow siblings
across a day, and availability is drawn as an affordance instead of an event card:
dotted outline, no fill, time-only label at 62% opacity, lighting up on hover and
keyboard focus. Booked and original lessons keep their solid service colour, so they
are the only filled things on the grid.
- Available slots lead with the time alone; program and teacher were noise repeated 21
times down the week.
- The separate Available-times list now appears only in the tighter family reschedule
drawer, not beside the calendar where it competed with the map.
- Noted, not fixed: the same date and time as the lesson being moved can still be
offered as available, because the moved occurrence is excluded from conflicts.


## Setup catalogues and an available-times prototype — November 17, 2026

- **Group and event types now live in School Setup**, next to services and rooms, in
two new sections. They ship prepackaged so an owner does not hand-build a catalogue:
three group types (Band, Ensemble, Practice team) and six event types (Performance,
Camp, Workshop, **Birthday party**, **Karaoke night**, **Private event**). Each record is
only a name, a description and an Available flag.
- **Fixed a crash this introduced.** The setup sidebar icons were a positional array of
six, so the two new sections indexed past the end and threw during render. Icons are now
looked up by section id with a fallback.
- **Available-times prototype in rescheduling.** Reschedule now lists the times a family
can actually pick, grouped by day, alongside the calendar instead of leaving them to
interpret empty grid space: `Wed, Nov 4 · 2:00 pm 2:30 pm 3:00 pm …`. Each entry is a
toggle button that selects the slot, the current booking stays in its own panel, and the
same availability calculation drives both views. Observed 75 selectable slots across the
week with no page errors.
- Still open, deliberately: billing fields and charge-on-save, multi-staff bookings, and
having the Beta explorer read these setup catalogues instead of its own copy.


## Booking context, staff duties and studio engineering — November 17, 2026

The chooser now reflects what the clicked calendar column can actually host, and the
enrollment stepper is no longer opened inside a dialog.

- **One chooser, then the full screen.** The lesson path saves the enrollment draft and
  navigates to `?screen=book&draft=<id>`, so the stepper opens on the existing
  full-screen enrollment surface. The dialog no longer hosts the stepper, and the
  premature "Send to family" control is gone with it. Verified from both CTAs: no open
  dialog, page heading `Enroll a student`, draft id in the URL.
- **Teacher column.** Lesson, Single lesson, Staff duty and Block. Band rehearsal appears
  only when that teacher teaches a band service; Studio booking appears only for a
  teacher with a studio engineering level. Event is never a teacher's diary entry.
- **Room column.** Staff duties are not a room decision, so Front desk and Admin are
  absent. Studio hire requires the room to be listed for a room-kind service — the
  shared `roomSupportsBooking` previously returned `true` for studio on every room,
  which is why Maroon 5 offered studio hire.
- **Front desk and Admin are one task.** A single **Staff duty** card opens the same
  form with a Duty type select; the existing Duty notes field travels with it.
- **Studio engineering is a staff skill, not a service.** `TeacherEditor` gains a
  Studio engineering level (none / 1 assistant / 2 engineer / 3 senior). Studio
  bookings require an engineer, the field is labelled Studio engineer, and the list
  contains only qualified staff. Isabel Rivera is seeded at level 2 so the capability is
  demonstrable; everyone else is not an engineer.
- **The student picker is a search dropdown** and hides students who already hold the
  selected lesson type, so the "Existing subscription" prompt no longer appears after a
  selection that could never succeed.
- **Rehearsals take people, not only students.** Band or at least one participant is
  required; participants include staff, carried on a new `participantIds` field that
  `bookingParticipants` merges for capacity and conflict checks. The teacher list for a
  rehearsal contains only band-qualified staff, and an empty list explains itself rather
  than offering a dead control.
- **Bands are named meaningfully.** The sample bands were generated as
  `Academy Ensemble 3`, which is what made a rehearsal header look arbitrary; they now
  read `<program> · <teacher>`.
- Verified: teacher cards for an engineer vs a non-engineer, room cards for Maroon 5 and
  the Performance Room, the rehearsal participant picker and staff filter, the studio
  engineer field, and both full-screen hand-offs. Suite 1,160/1,160, `tsc` and lint
  clean.

## One enrollment-and-booking flow — November 17, 2026

The agreed structure is now implemented: **either entry point opens the same modal, the
same booking-type cards and the same enrollment stepper**. No second form, no handoff to
another section.

- **One entry screen.** `BookingFlow` owns the dialog. Enroll & Book's `Add booking` and
  Calendar's `Add booking` both open it, so the older Enroll-path card chooser
  (`EventExplorer`'s `lessonChooser`) now defers to the shared flow when the Beta context
  provides one; its standalone card modal remains only for hosts without that context.
  Both CTAs were verified to render the identical eight cards: Lesson, Single lesson /
  Free trial, Studio booking, Band rehearsal, Event, Front desk, Admin, Block /
  unavailable. Non-lesson bookings stay in the same entry screen — nothing is
  Calendar-exclusive.
- **Calendar supplies context, not a second workflow.** Selecting a slot in a teacher
  column opens the same cards titled `Book time with <teacher>`; a room column opens
  `Book room <room>`. Cards are filtered by what that resource can actually host, which
  is why the room view drops Band rehearsal and Event. The chosen path then opens the
  shared stepper with the known date, time, duration, teacher, room and service already
  filled, and the teacher is preselected as the schedule preference.
- **Options come from School Onboarding.** The stepper's Service and Length controls now
  read the configured services and their `durations` whenever the Beta context is
  available, instead of the sample `30 / 45 / 60` list. The calendar-origin 30/60
  restriction is gone. Service changes on a saved booking also adopt that service's
  first configured length; a lesson's length no longer leaks into a room booking.
- **Send to family to complete** is available inside the shared lesson flow, not only
  from the enrollments table.
- Verified at 1440 and 390: identical cards and stepper from both CTAs, contextual titles
  per resource, prefilled student/service/date/time/duration/teacher, no page errors and
  no horizontal overflow. Suite 1,160/1,160, `tsc` and lint clean, production build
  compiled.

## Beta access fixed — November 16, 2026

- **Blank screen (my bug, now fixed).** Giving Beta its own work area made the sidebar
  assume the current area was authorized (`area!.links`). Any Beta path viewed by a
  session without the Beta area threw during render, so `/odeon-demo` came up blank.
  The nav now falls back to Operations and an empty link list, and the icon lookup
  falls back too.
- **The owner could not get in.** Middleware gated `/odeon-demo` on
  `requireAccountAdministrator`, which only understands a personal Supabase session.
  Signing in with the shared staff password creates a legacy session, so the gate
  bounced you to Settings before the page rendered. Beta paths now accept that
  password session; personal owner/admin accounts still pass and everything else is
  unchanged: personal staff accounts and other tenants are still redirected, as
  `beta-access.test.cjs` requires. Design, Website content and the prototype lab keep
  the stricter personal-session check.
- **The yellow BETA button stays** in the sidebar footer and is no longer hidden from
  non-administrator viewers, so the staff team can reach the preview.
- **Decision: any signed-in member of the school may preview Beta**, because it shows
  fictional sample data only. Personal owner, admin and staff accounts all pass the
  middleware gate, the shared password session continues to pass, and the Beta work
  area appears in the switcher for those roles. Anonymous visitors, revoked
  memberships and other tenants are still redirected. This was a deliberate change to
  the existing contracts: `beta-access.test.cjs`, `membership-logins.test.cjs` and
  `work-area-navigation.test.cjs` were updated with the reason recorded beside them,
  not deleted. Design, Website content and the prototype lab keep the stricter
  personal-session administrator check.
- Verified: suite 1,160/1,160; signed in with the staff password, the BETA button
  navigates and `/odeon-demo`, `?screen=teacher` and `?screen=calendar` all render.

## Main navigation trimmed — November 16, 2026

- **Event RSVPs** is removed from Operations: that event has passed. **Campaigns**
  is hidden for now, not deleted. Both routes still render at `/dashboard/rsvps`
  and `/dashboard/history`, so nothing is lost and either can be re-linked in one
  line when it earns its place.
- Operations is now: Overview, Notes, Leads, Contacts, Communications, Teachers &
  staff (plus Settings). Verified on the signed-in app; suite 1,159/1,159.

## Beta leaves the main navigation — November 16, 2026

- Teacher day and Calendar no longer sit in **Operations**. Operations means the
  real app and real records, so the beta screens now live in their own **Beta**
  work area, still owner/admin gated, described as "Preview with fictional sample
  data — never a real school". `/odeon-demo` and `/beta` route to that area.
- The teacher screen states its data source: with sample data it prints "Sample
  school · these are fictional teachers and students, not a real school"; with a
  tenant selected it is absent and the screen uses the signed-in staff identity.
- Verified: `work-area-navigation.test.cjs` asserts Operations contains no
  `/odeon-demo` link and Beta owns Teacher day then Calendar; signed into the real
  app, neither link appears on `/dashboard`. Suite 1,159/1,159.

## UI truth, scheduling access and the teacher day — November 15, 2026

- **Test suite is green again: 1,158/1,158.** The six previously failing UI and
  navigation assertions split into two kinds of problem and were fixed at the
  right layer rather than deleted:
  - *Moved behaviour*: `notification-navigation` and `task-notification` now
    read note links and the daily composer from `components/notes/DashboardNotes.tsx`,
    where that code lives after the page became a wrapper. `event-rsvps` failed
    only because the harness transpiled without `esModuleInterop`, so the CSS
    module import resolved to `undefined`; the rendered markup was always
    correct. `task-notification`'s token stub was missing `interaction`.
  - *Real violations*: the ten native `<button>` elements now use
    `Button`/`ControlButton`, and the 33 call-site style overrides were replaced
    with shared control kinds (`slot`, `row`, `toggle`, `swatch`, `block`,
    `card`, `subtle`, `link`) instead of being allowlisted. `ControlButton` owns
    the appearances; call sites keep event semantics.
- **Reset filters is back on desktop.** The calendar toolbar shows **Reset
  filters** only while a filter, hidden unavailability or a week resource is
  active, and it clears all of them — the same payload the mobile panel uses.
  The `calendar-appearance` assertion still forbids the old `Clear filters`
  wording.
- **45-minute classes are creatable, not just reschedulable.** Lesson durations
  now come from the selected service: Tiny Keys and Little Rockers offer only
  45 minutes and select it automatically, private lessons keep 30/45/60, and a
  service change adopts its first configured length instead of leaving an
  invalid one selected. Start times stay on `:00`/`:30`, and switching from a
  lesson to a room booking no longer carries the lesson's 45 minutes into a
  room reservation.
- **Band enrollments reach the calendar.** Scheduling a band now stores a
  structured `dailySchedule` (weekday and from/to) next to the display string,
  the band is marked as the series owner, and the completed membership records
  `seriesId`, `time`, `duration` and a first date. `expandPreviewCalendar`
  materialises the weekly series from that record, and band blocks are
  suppressed once an enrollment owns the series (`group.seriesId || group.id`),
  so a completed band appears exactly once with its members — and a band with
  no enrollment yet still renders from `dailySchedule`.
- **Teacher day rebuilt as a working screen.** Owner-only preview selector,
  mode-specific Day/Week controls, four summary cards, one `Today, Wed Nov 4`
  heading with time-only lesson cards (student, class, room; no repeated teacher
  or date), inline three-button attendance, Calendar's cancelled/rescheduled
  treatment, To-do cards that disappear when attendance and notes are both done,
  sticky notes that mention the teacher, availability reusing the School Setup
  editor with write-through, and a profile tab for name, email, photo and
  teaching skills by level. The prototype banner and sample-data strip no longer
  appear above a teacher's own screen.
- Evidence: `beta-mobile-teacher-browser.cjs` (1440/390 — banner absence, heading
  text, 4/4/4/4 summary, mode-specific controls, attendance state, To-do, notes,
  messages, availability, profile, no writes/errors/overflow);
  `beta-booking-policy-browser.cjs` (service-driven durations, 45-minute
  acceptance, saved room and block bookings, 1440/390);
  `beta-academy-calendar-browser.cjs` (staff filter, Reset filters in toolbar and
  mobile panel, block actions, room reservation, cancelled lesson) — both
  previously stale scripts repaired (renamed rooms, removed `Clear filters`,
  `View by` segmented control, current storage key, mobile filter panel);
  `beta-reschedule-availability.test.cjs` (10 contracts including the band
  series and the 4/4/4/4 teacher summary assumptions).
- Remaining red flags: live school storage is still unprovisioned (the
  migration and API exist but have not been applied, and there is no
  staff→teacher identity mapping, so a real teacher cannot sign in to "their"
  schedule yet); attendance, notes and message drafts remain unsent screen
  state; Calendar's own reschedule panel keeps its parallel slot loop for band
  occurrences and remains slated for the shared enrollment-and-booking
  unification.

## Plumbing audit — November 15, 2026

- **Onboarding now opens the academy’s existing configuration by default.** The
  Beta shell already passed its saved sample setup into School Setup, but the
  component still defaulted to the empty “new school” fixture until
  `experience=configured` was present. It now selects the configured records
  whenever setup data is supplied, on first render and on history navigation.
  Sample-only; no migration, tenant provisioning or permission change.
- **One availability calculation for rescheduling.** Added
  `beta-source/lib/academy-reschedule-availability.ts`, which resolves slots
  through the same `bookingReason` policy Calendar uses: configured services and
  durations, teacher assignments, weekly/date-specific hours, time off, rooms,
  closures, teaching-policy breaks and existing occupancy. `DemoWorkspace`
  publishes it through `CalendarEnrollmentContext`; Contacts reschedule,
  recurring change, makeup booking, family batch reschedule, the parent portal
  and its validation all use it. Standalone callers without a configured context
  keep the previous fixture resolver as a default.
- **Teacher day reads date-specific hours.** The Availability panel now shows
  `teaching hours · <date>` from the same `teacherHours` helper the Calendar
  validator uses, plus the base weekly hours as a secondary list. Proposals
  remain component-local and are still not submitted.
- **45-minute configured classes are schedulable.** `bookingReason` now accepts
  a duration that is a multiple of 15 minutes when the selected service lists
  it, while start times stay on `:00`/`:30`. The sample Tiny Keys classes are 45
  minutes and were previously rejected by the shared validator, so neither
  Calendar nor Contacts could move them.
- Evidence: full suite **1,150/1,156**; the same six pre-existing, unrelated
  UI/navigation source assertions fail before and after this change
  (`button-boundary`, presentation, DataGridTable guest table,
  notification-navigation, swatch shape, daily composer colors). Production
  build passed (exit 0). `beta-reschedule-availability.test.cjs` (8 contracts)
  covers configured hours, booked slots, time off/date overrides, service
  assignment, 45-minute classes, move validation, onboarding defaults and shared
  wiring. `beta-plumbing-availability-browser.cjs` passes at 1440/390px with no
  page errors or horizontal overflow; mobile teacher, family reschedule, setup
  scheduling and onboarding shell regressions also pass.
- Remaining red flags: Calendar’s own reschedule panel still runs a parallel slot
  loop (needed for band occurrences without an enrollment); the lesson dialog
  still offers only 30/60-minute new bookings, so configured 45-minute classes
  are reschedulable but not creatable there; teacher availability proposals,
  notes and messages remain unsubmitted previews; the larger shared
  enrollment-and-booking unification remains separate agreed backlog work.

## Current status — merged and pushed, November 15, 2026

- Merge `61ce7bb` landed the validated integration on main and was pushed;
  live remote main matched that SHA. The merge tree exactly matches integration
  checkpoint `f0a3477`. Beta middleware/access gating remains unchanged.
- Reinstalled main dependencies from the committed lockfile. Full suite passed
  again on merged main: 1,099/1,099. Full production build passed on merged main
  with existing staging configuration, including page-data/static generation.
- Main's redundant pre-merge working state remains in the named
  `beta-main-promotion preserved baseline 20261115` stash and private archives.
  Main's working tree was clean after merge; no pending work was overwritten.
- Preview source/import/dependency links now target `/Users/brunowong/pulse`.
  Restarted the loopback-only host after preserving stale generated dependencies
  and cache; HTTP 200 and six-destination navigation passed at 1440/390px.
- Post-merge cleanup recovery passed at
  `/Users/brunowong/pulse-backups/beta-main-cleanup-20261115-085956`.
  Only the merged Beta integration line is eligible for removal; protected Odeon
  refs, other unmerged worktrees and both stashes remain retained.
- No manual deployment or database migration performed. Hosted deployment state
  is not verified; push-triggered CI may run independently. Shared school storage
  remains unprovisioned and impersonation remains sample-only.

## Historical main promotion authorization — November 15, 2026

- User authorized committing the reviewed integration to main while retaining
  Beta gating. Final full suite passed 1,099/1,099, including anonymous/staff/
  cross-tenant denial and Owner/Admin access. Middleware is unchanged from main.
- Main's 11 dirty source paths exactly match the preserved `e003edf` baseline;
  park their redundant working state before merging, retaining the stash/archive.
  Shared UI/performance changes intentionally affect operational screens too;
  the Beta gate is not represented as isolating shared components.
- Fresh backup/recovery passed at
  `/Users/brunowong/pulse-backups/beta-main-merge-20261115-085752`:
  all five branches restored and all four worktrees hash-verified, including
  private ignored configuration. Protected Odeon refs/unmerged work stay intact.
- Promotion procedure: merge without rewriting history, push main, verify remote
  ancestry/content, then remove only the merged integration branch/worktree after
  a refreshed final backup gate. No deployment or database migration is part of
  this operation; pushing may trigger externally configured CI/deployment.

## Historical validation repair — November 15, 2026

- **Production build now passes (exit 0), including page-data collection and
  static generation.** Existing staging credentials were available in main's
  `.env.local`, but the integration worktree had no env file. Configured a
  private, Git-ignored, owner-only integration `.env.local` with six existing
  Supabase variables, verifying both URL aliases against documented Odeon staging.
  No dummy credentials, production secrets, database writes or migrations.
  Tenant-selection/storage/Settings checks passed 88/88 after configuration.
  Docker is installed but its daemon was stopped; Docker was not needed to fix
  this build. Build-time readiness is not live-school persistence approval.
- Full domain/security suite is now **1,099/1,099 passing**, including two new
  Settings account-context failure/unmount regressions. Focused tests, changed
  test lint, explicit TypeScript and diff checks pass.
- Reconciled obsolete test contracts with existing intended behavior: Undo was
  deliberately removed by `bb023f0`; Settings uses the shared account-context
  loader; Contacts/Leads use adapter transport and interaction tokens. No runtime
  permission checks or application behavior were weakened to satisfy tests.
- Enrollment/band browser checks now read the sample snapshot from localStorage
  (workflow queue remains sessionStorage) and cover both 1440px and 390px. Mobile
  band navigation explicitly opens the existing menu before following the link.
  All six enrollment/band cases passed, as did calendar controls, navigation,
  onboarding round trips and impersonation/exit at both widths. See
  `docs/beta-promotion-review.md` for scope and remaining build limitations.
- Historical pre-configuration build attempt: compilation and type validation passed; page-data
  collection still fails with `supabaseUrl is required` (this run encountered
  `/api/account/email-signoff`). Approved nonproduction configuration is still
  required at that point. This blocker is resolved by the configured build above.
  No credentials were fabricated or production secrets copied.
- Agreed human/agent direction and the anti-over-polishing agreement are in
  `docs/Odeon-AI-vision.md`; `AGENTS.md` links and enforces the guidance.
- Main remains `9d5c5cc`, confirmed against the live remote. No merge, push,
  deployment, migration or branch/worktree deletion occurred in this repair.
  Sample-only impersonation and browser/live-school isolation remain unchanged.

## Historical promotion review — November 14, 2026 (superseded)

- The user requested promotion of all recent Beta work: calendar, enrollment,
  bands, onboarding, navigation, contextual sample-parent impersonation and shared
  UI. These changes are being preserved together on `integration/beta-20261113`.
  **Not merged into main, pushed or deployed.**
- Live remote `main` was checked and remains `9d5c5cc`, matching local main.
  Main's original dirty working files are preserved; the existing `e003edf`
  integration checkpoint includes that pending performance work. Protected Odeon
  refs and the other worktrees remain untouched.
- Fresh full domain/security run: **1,097 tests; 1,085 passed, 12 failed**.
  Seven failures reproduce against main's archived working state: Undo-copy,
  Settings layout, and five Settings rendering/access assertions. Five additional
  failures need resolution on the integration: two ControlButton harness failures
  (missing interaction-token mock), Contact insights transport assertion, Contacts
  toolbar contract, and Leads effect-dependency assertion. Do not weaken assertions
  or classify all failures as baseline without evidence.
- Explicit TypeScript check passed. Edited/new-code ESLint passed with warnings
  (zero errors). `git diff --check` passed. Production build compiled and passed
  type validation, then failed collecting `/api/account/access` because
  `supabaseUrl` is required. Approved nonproduction Supabase configuration is
  still unavailable; no production secrets were copied or dummy credentials used.
- Backup and recovery gate passed for all five local branches and all four
  worktrees, including ignored/untracked source files and hash-verified replay.
  See `docs/beta-promotion-review.md` for durable evidence and exact locations.
- Shared school storage remains unprovisioned. The migration is source only and
  has not been applied. Impersonation remains sample-only; no live authentication,
  payment activation, contact import or live-school mutation is approved here.
- Release remains blocked by the failing suite and incomplete production build.
  Fresh navigation and onboarding/impersonation browser runs passed at 1440/390px;
  enrollment/band completion rerun failed reading a null persisted `snapshot` and
  is also a release blocker. Historical completion passes do not supersede it.
  Do not delete the active integration worktree/branch before an approved merge
  and a refreshed backup/recovery gate.

## Historical status — November 13 checkpoint (superseded)

- Working directory: `/Users/brunowong/pulse-beta-integration`; branch
  `integration/beta-20261113`. Main remains `9d5c5cc` and matches the live remote
  ref checked during the hygiene pass. Nothing merged, pushed or deployed.
- Committed integration checkpoints: `e003edf` preserves main's pending
  performance work; `ba68944` patches dependencies; `656ab1a` promotes shared
  controls; `f167748` reconciles models/Parent workflows and Leads adapters;
  `17d958e` corrects sample ownership to reuse existing Beta identities.
- Beta sample families/students remain authoritative. No prototype directory is
  added to the Parent selector. Workflow state starts empty against those IDs.
  Full synchronization of later sample-session edits with the staff queue is
  still a pending integration concern, not a proven database feature.
- The latest verified suite is 316/316, with passing TypeScript and focused
  correction lint. Desktop/mobile Parent continuation, family reschedule/makeup
  and Reschedule together passed their respective browser runs. Sharp runtime
  conversion passed. These are scoped checks, not full release approval.
- Staff Explorer, its Contacts action/adapter composition, image controls and
  supporting primitives remain dirty/untracked WIP. TypeScript passing does not
  establish those unfinished screens as functional or approved. Preserve this
  WIP; do not publish it or include it in a documentation-only commit.
- Beta sidebar wiring now exposes Contacts, Opportunities, Enroll & Book,
  Bands & ensembles, Events and the existing Staff, plus Parent portal and
  School Setup. Exact wording of the user's latest dictated labels remains
  unconfirmed; no Contracts screen or replacement Staff screen was invented.
  Keep the prototype access
  guard, operational API routes, main's newer calendar and permission/security
  behavior. Real contacts and transactions remain disconnected.
- Full production build is still blocked by missing approved nonproduction
  Supabase configuration. Earlier audit evidence reports zero production
  findings and seven tooling-inclusive findings; it is historical, not a fresh
  audit in this documentation/hygiene pass.
- Ongoing principles are in `docs/integration-principles.md`. Hygiene details and
  recovery locations are in `docs/beta-hygiene-20261113.md`.

## Workflow completion validation and Beta projection — uncommitted WIP

Validated the three items that were previously unproven, in the isolated review
host (`http://127.0.0.1:3231/odeon-demo`, no production middleware):

- **Enrollment/booking completion.** The four-step wizard completes from
  Contacts, records the booking as Booked with the correct payment state
  (paid for card, unpaid for "add payment later"). It previously stopped there:
  the booking never reached Beta's student record, lessons, Parent portal or
  Staff. The Explorer now reports a finished booking once and the Beta workspace
  writes it into the family's own records through
  `beta-source/lib/beta-workflow-projection.ts`, which validates every field and
  writes nothing when anything is invalid.
- **Band completion.** Band creation, candidate requests, the band enrollment
  wizard (student, band, policies, payment) and confirmation all work: the
  member becomes confirmed, the candidate list clears, the inquiry moves to
  Enrolled, and the membership is now recorded on the student's program list.
- **Staff/Setup sharing.** Setup edits already persisted and reached the
  Explorer's teacher lists, but the Staff screen kept its own copy of the team
  and attributed students by teacher name. Staff now reads the same School Setup
  teacher records, and students are attributed by teacher identity
  (`PreviewEnrollment.teacherId`), with the sample seed carrying that id.

Resulting behavior: a booked lesson appears on the student record, in the
family's lessons and in the Parent portal; a confirmed band membership appears
as the student's program. Sibling isolation holds — a booking for one student
never touches a sibling or another family.

Open gap that matters for the academy calendar: the lesson scheduling grid
still assigned the prototype's own teachers (Jordan Vale, Robin Ellis, …) rather
than the academy's School Setup staff, so a booked lesson's teacher was not a
Staff member and the projected record had no teacher identity. That is now
reconciled — see the schedule source section below.

Checks: TypeScript, focused lint and whitespace pass. 152/152 academy, Beta
access and shared-control tests pass, including six new projection tests.
Repeatable browser regressions: `scripts/security/beta-workspace-navigation-
browser.cjs` (eight destinations, two widths) and
`scripts/security/beta-workflow-completion-browser.cjs` (card booking, unpaid
booking and band membership) pass with no page errors, `/api/` requests or
horizontal overflow. Evidence: `/tmp/odeon-final-{types,lint,tests}.log`,
`/tmp/odeon-nav-regression.log`, `/tmp/odeon-completion-regression.log`,
`/tmp/odeon-band-staff-isolation.log`, `/tmp/odeon-staff-unified.log`.

Nothing committed, merged, pushed or deployed. Full build still requires
approved nonproduction Supabase configuration.

## School Setup is the single schedule source

Per the user's decision, the academy's School Setup is now the only source for
teachers, rooms and availability. `beta-source/lib/beta-academy-schedule.ts`
derives the staff roster (programs taught, weekly hours, location) and the
academy's rooms from the setup records, and reads the teaching already booked
from the academy's own enrollment and lesson records.

- The enrollment wizard offers those staff, with slots limited to the hours
  they keep, the programs they teach, and no overlap with their own teaching
  or the student's existing lessons. The prototype's own roster remains the
  fallback for academies without configured staff, and the parent's own
  self-scheduling flows are unchanged.
- A completed booking now records the academy teacher's identity and a room
  from the academy's locations. Verified in the browser: the booking shows
  "Maya Chen" with teacher id `demo:teacher-1` in room "Keys classroom", and
  the Staff screen attributes the student to that teacher (eight students
  instead of seven).
- The wizard's step validation previously re-checked the slot against the
  prototype roster, so an academy teacher could never pass it. Validation now
  uses the same availability source the grid renders.

Checks: TypeScript, focused lint and whitespace pass; 157/157 academy, Beta
access and shared-control tests pass, including five new schedule tests and the
completion regression for card booking, unpaid booking and band membership.
Evidence: `/tmp/odeon-final3-{types,lint,tests,completion}.log`,
`/tmp/odeon-academy-booking-proof.log`.

Still open for the academy calendar: the calendar's own shape (day or week
first, what a row shows, whether staff can edit from it) and its place in the
Beta navigation. The calendar can now read one consistent source for lessons,
bands, teachers and rooms.

## Academy calendar — full screen, Beta's daily view

Built to the user's brief: a full-screen calendar for the academy's today and
week, filterable by staff, group, room and service, with block details, owner
actions and booking from the grid. It is a new Beta destination
(`/odeon-demo?screen=calendar`) and the first item in the sidebar.

- **What shows.** Lessons come from the academy's own enrollment and lesson
  records through the same recurring expansion the family portal uses, so both
  views agree. Band rehearsals come from a band's own weekly schedule and
  event sessions from an event's dates and daily schedule. Each block carries
  the student, teacher, room, program and service type.
- **Filters and staff view.** Staff, group, room and service filters narrow the
  week; choosing a staff member shows that person's teaching, which answers
  "who is working which days". Day view and previous/next week are available.
- **Block details.** Clicking a block shows what the lesson is, who the student
  is, who the teacher is, the room and the status, with quick access to the
  student's record.
- **Actions.** Cancel marks the lesson cancelled and keeps it visible; Reschedule
  moves it to another date, time or teacher; Message opens the shared composer
  for the family by SMS or email.
- **Booking.** Clicking an empty slot opens the existing enrollment wizard
  prefilled with that date and time. The student is chosen first, the family's
  contact pays, and the flow can create an ongoing subscription or an à-la-carte
  lesson. The completed booking is written into the family's own records by the
  same projection the Contacts flow uses, and appears on the calendar at once.

Checks: TypeScript, focused lint and whitespace pass; 162/162 academy, Beta
access and shared-control tests pass, including five new calendar tests.
`scripts/security/beta-academy-calendar-browser.cjs` passes at 1440px and
390px: full-screen week, staff filter, block details and actions, booking from
a slot and cancelling it, with no page errors, `/api/` requests or overflow.
Evidence: `/tmp/odeon-final4-{types,lint,tests}.log`,
`/tmp/odeon-cal-regression.log`, `/tmp/odeon-calendar-full.log`.

Known limits, stated plainly: a booking is a lesson or service for one student
at one time; reserving a room for a fixed window (for example the performance
room from 4:00 to 6:00) is a room booking, which the academy does not model
yet. Blocks are not draggable, and the calendar does not yet show staff
availability for unbooked hours.

## Connected sidebar validation — uncommitted WIP

- Embedded Explorer uses the Beta shell rather than a second sidebar. Contacts
  selected-account actions expand to student IDs for enrollment, opportunities
  and band creation. Existing Staff remains the Beta Staff view.
- Fixed embedded Parent portal covering and disabling the Beta navigation:
  embedded mode now stays in document flow and does not make shell siblings
  inert or lock body scrolling. Standalone preview isolation remains the default.
- Fresh checks: TypeScript, focused wiring/Parent/browser-test lint and whitespace
  checks pass; 146/146 academy, Beta access and shared-control tests pass.
- Repeatable browser regression:
  `scripts/security/beta-workspace-navigation-browser.cjs` passes at 1440px and
  390px across all eight sidebar destinations, including leaving Parent portal.
  No page errors, `/api/` requests or horizontal overflow in those runs.
- Parent enrollment open/save/resume regression passes at both widths. Contacts
  actions were also exercised locally: Alex Adams expands to Emma Adams in all
  three workflows; band review/save preserves Emma's ID and enrollment selects
  Alex as account contact and Emma as student. No API requests or page errors
  in that action run. Opportunity creation was opened, not submitted.
- Evidence: `/tmp/odeon-beta-resume-{types,lint,parent-lint,tests,browser,actions,
  parent-browser,navigation-regression}.log`. Review host remains isolated and
  omits production middleware; these results do not establish deployment safety.
- Remaining: end-to-end enrollment/booking and band completion, shared Staff/
  Setup edit validation, sibling isolation after those completions, and audit of
  sample-to-queue merging for stale IDs and workflow-field overwrites. Do not
  treat the existing merge as a proven synchronization solution.
- Nothing committed, merged, pushed or deployed in this continuation. Full build
  still requires approved nonproduction Supabase configuration.

## Sample-data correction — existing Beta directory wins

User clarified that the prototype's fake contacts should not be imported into
Beta. Runtime queue initialization now projects the existing Beta sample account
and student IDs through `academy-beta-people.ts`; it seeds no prototype contacts,
inquiries, registrations or band memberships. Parent family selection uses only
the existing Beta snapshot again. No real contacts or APIs are involved.

The queue uses `odeon:beta-enrollment-portal:v2` so older prototype queue storage
cannot silently restore the separate directory. Old storage is not deleted.
Legacy lifecycle tests inject their own explicit fixtures; a new regression
asserts that runtime people all belong to the Beta sample directory.

Validation: 316/316 targeted tests, TypeScript, focused correction lint and
whitespace checks pass. Parent request open/save/resume passes at 1440px and
390px using an existing Beta student, without operational writes/errors/overflow.
Evidence: `/tmp/odeon-beta-existing-people-{full,lint,browser}.log` and
`/tmp/odeon-beta-staff-types.log`.

The staff Explorer reconciliation begun after the previous checkpoint remains
uncommitted and unexposed; Contacts action integration and review are unfinished.
Its institution switching no longer restores prototype contact fixtures. This
correction checkpoint is separate from that unfinished UI work.

## Domain and screen reconciliation checkpoint

Reconciled Beta enrollment, band, program, opportunity and workflow models under
`beta-source/lib`. The portal actions, queue, store and hook live there together;
Parent enrollment consumes that same hook. There is no copied root queue/store.
This remains fictional same-tab session transport, not authorization or payment
infrastructure. This checkpoint originally projected queued accounts into the
sample workspace; `17d958e` subsequently removed that behavior in favor of Beta's
existing families. Request drafts can open, save and resume without operational
writes.

StaffEnrollment now uses the shared stepper, search picker, checkbox and synthetic
card preview. School Setup gains optional embedded sections and externally owned
discount configuration, retaining default standalone behavior. Existing calendar,
makeup, family reschedule modules and their CSS were retained, not replaced.

Shared Leads now accepts an explicit fictional request adapter while the default
remains fetch. Main's coalesced account-context permission loading, debounced
summaries, records cache, pagination, deletion checks and server routes remain.
The fictional adapter supports main's summary-only and include-counts contracts.
Dependent editors/composers receive the same request boundary; main's SMS review
and campaign-create error handling were retained. Band-only student fields are
opt-in; ordinary student editing keeps its established composition.

Not yet reconciled/exposed: the full staff Explorer, its Contacts panel adapters,
and staff navigation placement. Only BandEnrollment and ProgramAvailability were
ported from that directory as Parent dependencies. Do not interpret the shared
Leads adapter as approval to expose the whole staff explorer or to remove its
development-only guard. No operational API route changed in this checkpoint.

Validation on the isolated integration worktree:

- 315/315 domain, adapter-contract, Beta-access, Leads, performance-context and
  conversation tests passed; the final run is recorded in
  `/tmp/odeon-beta-reconcile-full-tests.log`.
- TypeScript and whitespace checks passed. Focused lint has no errors; existing
  unused-variable/image/hook warnings remain in older large Leads/composer files.
- Desktop 1440px and mobile 390px browser checks passed for family reschedule and
  makeup, Reschedule together, and Parent request open/save/resume. No operational
  writes, runtime errors or horizontal overflow in those checks.
- Sharp 0.35.5 decoded PNG, resized 16x16 to 8x8, encoded WebP and read metadata.
- Browser host `/tmp/pulse-beta-reconcile-host` on loopback port 3231 imports this
  integration worktree, not the original prototype. It omits production middleware
  and therefore does not validate deployment access controls.
- Production build remains blocked by missing approved nonproduction Supabase
  configuration; no secrets were copied and no deployment claim is made.

Evidence: `/tmp/odeon-beta-{calendar-browser,reschedule-browser,parent-browser-final,
reconcile-types,reconcile-lint,final-reconcile-lint,reconcile-full-tests}.log`.
No merge, push or deployment performed.

## Isolated release line

- Worktree: `/Users/brunowong/pulse-beta-integration`
- Branch: `integration/beta-20261113`, based on main `9d5c5cc`.
- Baseline commit `e003edf` preserves main's eleven pending tracked/untracked
  performance-related files. Originals remain unchanged; no push or deployment.
- Backups: `/Users/brunowong/pulse-backups/beta-integration-20261113`.
  All refs bundled; both working states restored into a disposable recovery repo
  and all 11 main / 127 prototype file hashes verified. A second bundle lives at
  `/Users/brunowong/odeon-private/pulse-branch-backups-20261113/beta-integration-all-refs.bundle`.
- This temporary release worktree is an explicit isolation exception to the
  normal one-release-line worktree limit. Do not delete any original/protected
  worktree or branch. Reconcile and perform the required recovery drill before
  eventual cleanup.

## Dependencies (historical patch checkpoint)

Next and eslint-config-next are pinned to 15.5.29, without a framework major
upgrade. Compatible transitive versions are refreshed in the lockfile, including
axios 1.21.1, follow-redirects 1.16.3, qs 6.17.1 and sharp 0.35.5. Next 15.5.29
explicitly permits sharp 0.35.5. Its PostCSS 8.4.31 pin requires a scoped
`overrides.next.postcss = 8.5.32`; both PostCSS consumers now resolve to 8.5.32.

`npm audit --omit=dev`: zero findings (previously eight affected production
packages). The full tooling-inclusive audit still reports seven affected dev
packages: six moderate and one high. Do not describe the entire dependency tree
as clean. Remaining findings involve TypeScript ESLint/minimatch and an older
brace-expansion dependency. No forced major upgrades performed.

Installed into this worktree independently with install scripts disabled; no
shared node_modules mutation. The production build compiled and passed its type
stage, then failed page-data collection because Supabase configuration is absent
(`supabaseUrl is required` for `/api/account/claim`). No production secrets copied,
the dependency audit alone; validate actual image processing before release.
no successful full build claimed. Sharp installation/runtime was not proven by
this dependency audit alone; the later runtime conversion check is recorded
above and passed.

## Shared component promotion (historical checkpoint)

- Added shared Checkbox, RadioOptionGroup/styles, WeekdayToggleGroup,
  ParticipationPolicies and SaveStatusNotice from the prototype.
- Promoted optional action-bar selection nouns, compact tab bubbles and stepper
  navigation/completion metadata. Existing default appearances/behavior retained.
- Reconciled sample-local table preferences with main's newer single-flight
  account-context loader; operational consumers keep that loader.
- Kept main's existing conversation harness. It already handles newer shared
  imports and passes; blindly copying the prototype repair would regress it.
- No wholesale Contacts/Leads replacement, API/middleware replacement or Beta
  calendar overwrite. No new workflow is reachable in Beta yet.

## Checks (historical shared-control checkpoint)

- 90/90 targeted tests pass: shared controls/tables, row selection, Leads table
  preferences and follow-up permissions/validation, conversation prototype,
  performance-context, visible polling and Beta access.
- The eight prototype follow-up failures do not reproduce on this main-based
  baseline. Retain main's newer API implementations.
- Focused lint and TypeScript pass. Diff whitespace check passes.
- New control tests exercise action-bar default/additive labels and clear,
  native radio selection callbacks, opt-in compact counts and opt-in step
  navigation. They are synthetic contracts, not browser/visual approval.
- No desktop/mobile browser checks or completed production build yet.

Evidence: `/tmp/odeon-beta-{shared-tests,final-lint,final-types,build}.log`,
`/tmp/odeon-beta-production-audit-final.json`, `/tmp/odeon-beta-final-audit.json`,
and `/tmp/odeon-beta-dependency-tree-final.log`.

## Remaining work

1. Finish staff Contacts/Leads composition and fail-closed simulated transport;
   use existing Beta sample identities and preserve complete operational UI.
2. Verify queue/sample-session ownership across staff and Parent consumers;
   retain one queue/store instance and explicit account/student relationships.
3. Agree staff navigation placement before exposing workflows. Retain access
   guards and run production-path access checks, not just isolated-host checks.
4. Complete integrated desktop/mobile staff workflow validation, including bulk
   actions, panels, drafts, sibling isolation and unexpected network requests.
5. Complete production build with approved nonproduction configuration and
   reassess remaining development-tooling findings without blind forced upgrades.
6. Review final diff, release evidence and rollback checkpoints before merging
   or publishing. Real contacts, live bookings and payments remain out of scope.

### Front-end layout reconciliation

Supersedes the earlier full-screen calendar presentation. Calendar now remains inside the dashboard shell and uses the existing page container/header. PageContainer is nesting-aware; Leads no longer adds a second inset and Contacts uses the same component rather than duplicating its styles. The Beta PageContainer re-exports the canonical component.

Lesson/trial, band enrollment, event registration and create-band editors share EnrollmentLayout (header, stepper spacing, focus). Removed title back chevrons, retaining explicit close/save and step-level navigation. Single lesson/trial now enters the existing enrollment wizard with à-la-carte cadence, instead of the separate two-card editor. No database, API or billing-rule changes.

Validation: desktop/mobile shared-axis and duplicate-search browser assertions; calendar actions and card/pay-later/band completion regressions; TypeScript; focused lint; 172 academy/Beta tests pass. The broader security suite also reports nine failures in lead automation/profile/settings/loading source assertions; it is not all-green.

### Interaction-color/component-library reconciliation

Established shared `interaction` roles (blue selected/on/progress/focus; pale-blue selection surfaces; espresso primary actions; separate outcome/brand colors). The root layout publishes these roles as CSS variables, and legacy native controls inherit them. Reconciled Beta primitives delegate to canonical shared implementations. Added InteractionShowcase to `/dashboard/design` and an isolated `/interaction-review` route on the local review host.

Migrated enrollment raw self/deferred-payment checkboxes and duration/cadence/trial/payer fields; normalized table selection, weekdays, switches, radio cards, pills, tabs, both steppers, Setup progress and teacher/slot selection styling. Removed duplicate focus rings. See `docs/ui-interaction-colors.md` for the audit inventory and intentional exceptions; this is not a claim that every custom component or neutral hex literal has been eliminated.

Validation: 177 academy/Beta/interaction tests pass; TypeScript clean; focused lint clean (broader edited-tree lint retains warnings). Desktop/mobile interaction colors/keyboard/forced-colors, shared layout, calendar actions and enrollment/band completion browser regressions pass. No database/API/billing-rule changes.
