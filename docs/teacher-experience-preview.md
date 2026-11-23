# Teacher experience preview — November 15, 2026

Entry: **Operations → Teacher day**, immediately above Calendar, or
`/odeon-demo?screen=teacher`. Existing Owner/Admin Beta access gates are unchanged;
this is not a teacher login or a production teacher permission boundary.

## Scope

- The screen is a working day view, not an annotated mockup: no prototype banner,
  no "design preview" footer, and no sample-data strip above a teacher's own
  screen (the parent portal is treated the same way).
- **Owner-only preview selector.** The Teacher picker renders from
  `/api/account/me` `roleKey === 'owner'`. Any other signed-in staff member is
  locked to their own staff record: `/api/account/me` now returns `personId`, and
  the screen matches the teaching record by `values.personId` (falling back to
  the staff email for records created before person linking). A staff account
  with no matching record sees only "this login is not connected to a teaching
  profile yet" and never another teacher's day. Linking a login to a staff
  record is still done outside the UI, and needs live storage to matter.
- **Range controls are mode-specific.** Day shows **Today** plus a date picker;
  Week shows previous/next week, **This week** and the week-of label. Only one
  set is shown at a time.
- **Four summary cards**: sessions, students, attendance to mark and lesson
  notes to add for the selected period (4/4/4/4 in the sample).
- **Schedule** starts with one plain date heading, `Today, Wed Nov 4` (or
  `Wednesday, Nov 4` outside today), and never repeats the date inside a card.
  A card shows only `4:00–4:30 pm`, the student(s), the class and the room; the
  teacher name is not repeated. Attendance is three toggle buttons —
  **Present**, **No-show**, **Excused absence** — from the shared
  `attendanceOutcomes`, with `aria-pressed` state and no modal.
- **Cancelled and rescheduled lessons** reuse the Calendar/Contacts card
  treatment exactly: dashed border, 65% opacity, struck title and a
  `Cancelled`/`Rescheduled` badge. Plain scheduled lessons carry no badge, so
  the status is signal rather than noise.
- **Student roster** keeps the list and adds **Add note** and **Send message**
  per student, both opening the lesson note/message dialogs.
- **To do** lists only outstanding work: a lesson's card disappears once both
  attendance and notes exist. Attendance is the same toggle group used on the
  schedule; notes open the lesson-note dialog. Sticky notes that mention the
  teacher are listed with the shared sticky-note appearance (`noteBackground`,
  `NOTE_INK`) rather than bespoke styling.
- **Availability is published, not editable here.** The screen renders the School
  shared availability editor in read-only mode, bound to the teacher's record:
  weekly blocks, date overrides and time off are visible, but there is no **Add
  availability**, **Add Time Off** or drag-to-draw. **Only an owner/admin sets
  teacher availability**, in Main app → Staff → Qualifications & availability, because hours are
  agreed with the school offline and should not change unsupervised. The earlier
  weekday/from/to proposal form is gone.
- **Profile**: name, email, photo (`TeacherPhoto`) and teaching skills by level,
  saved to the teacher record.
- Attendance marks, lesson notes and message drafts stay in the screen and are
  discarded on reload; nothing is sent and no API writes are made.

## Product direction

The concrete task need is a teacher's daily follow-through, not another polished
admin calendar. Humans own teaching judgment, notes, family relationships and
availability exceptions. Agents may later collect missing actions and prepare
drafts; attendance evidence, family communication and schedule changes need
authoritative records and policy-enforced actions. Preserve the approval-first
direction in `docs/Odeon-AI-vision.md`.

Before live use: server-resolved teacher identity/assignments, roster and family
visibility permissions, auditable per-participant attendance, lesson-linked notes
with explicit audience, authorized communication threads/delivery, and an
effective-dated availability record with conflict checks (today availability
edits write straight to the sample school record). Do not mistake the owner
preview selector for authorization or these sample writes for multi-teacher
storage. Further cosmetic iteration should be deferred until teachers review the
daily workflow; it displaces reliable rescheduling and live permission work.

## Validation

- Full suite **1,158/1,158**, including the six UI/navigation source assertions
  that previously failed for unrelated reasons. Production build passed (exit
  0); TypeScript and lint report no errors.
- `beta-mobile-teacher-browser.cjs`: 390px and 1440px — no demo banner on the
  teacher screen, one `Today, Wed Nov 4` heading, four summary cards reading
  4/4/4/4, Date picker only in Day and week controls only in Week, inline
  attendance state, To-do filtering, notes/messages, setup-based availability,
  profile fields, no API writes, no cancelled or moved sample lessons, no
  browser errors or horizontal overflow.
- Rescheduling regressions (`beta-reschedule-availability.test.cjs`,
  `beta-plumbing-availability-browser.cjs`) prove onboarding opens configured
  records by default, Contacts reschedule uses Calendar’s configured hours and
  excludes booked staff time, and time off/date overrides apply.
- 45-minute classes: `calendar-booking-policy.test.cjs` and
  `beta-booking-policy-browser.cjs` prove the lesson dialog lists only the
  configured length (Tiny Keys and Little Rockers offer 45, private lessons keep
  30/45/60) and that a 45-minute lesson is accepted by the shared validator.
- `beta-academy-calendar-browser.cjs` (1440/390) covers the week view, staff
  filter narrowing and **Reset filters** in both the desktop toolbar and the
  mobile panel, block inspection, direct room reservation and cancelled-lesson
  rendering.
- Screenshots and command logs saved under `/tmp/{odeon-teacher,t2-*,teacher-*}`.
  Local preview validation does not establish hosted deployment readiness.
- Existing desktop calendar controls/profile/booking regression and desktop/mobile
  Beta navigation regressions passed. Mobile-specific filter checks now reside
  in the new browser script rather than the desktop toolbar geometry test.
- Removed the duplicate School Setup work area; Teachers & staff is retained in
  Operations. School onboarding keeps the configuration workflows and URL, with
  an app-aligned 252px left-pinned sidebar, full-width content, and a 72px mobile
  bar with an accessible navigation drawer. No centered max-width outer frame.
- `beta-onboarding-shell-browser.cjs` checks 1920px/1440px/390px shell geometry,
  area deduplication and navigation. `beta-shared-lesson-card-browser.cjs` checks
  Contacts selection, bulk checkbox and existing reschedule/cancel menus at
  desktop/mobile widths. Setup scheduling persistence regressions also passed;
  those tests now explicitly request configured fixtures.