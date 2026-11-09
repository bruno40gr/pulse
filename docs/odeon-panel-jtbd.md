# Panel JTBD and prototype brief

Owner walkthrough recorded November 3, 2026.

## Status and scope

This is the agreed task definition for the next prototype pass, not a description
of implemented functionality. Read alongside `odeon-student-overview.md`, which
records the existing prototype and its verification limits. These decisions
supersede earlier proposals to complete enrollment cancellation in the slidepanel,
combine makeup items into one booking, or apply makeups as payment credit.

Keep prototyping local and fictional. No production updates, migrations, real
messages, charges or private decision records. Current preview actions must not be
presented as persisted changes or working provider integrations.

## Prototype constraints — required

- Build only the agreed jobs below. Do not add speculative features, policies,
  controls, permissions or exception paths. Open questions stay open.
- No explanatory sentences embedded in the prototype. No descriptive filler,
  contrast framing, anticipatory error warnings or descriptions of what happens
  next if an action is taken. Put design rationale in documentation.
- Use concise headings, field labels, values, statuses and action labels. Reviews
  show concrete dates, amounts and affected items rather than explanatory prose.
- Show actual validation feedback when relevant; do not pre-populate the interface
  with hypothetical failure scenarios. Preserve accessible names and semantics.
- Reuse `components/ui` and `lib/tokens.ts`; follow `ui-layout-rules.md` and the
  repository's toolbar rules. No parallel card, field or button systems.
- Reuse `FieldGrid`, `DenseSectionPanel`, `SurfacePanel`, `Input`, `Select`,
  `Textarea`, shared headers and existing scheduling/enrollment components.
- Put card actions in the header's top-right actions slot. Keep conversation
  toggles in their surface header using `ControlButton` with `kind="toggle"`
  and `aria-pressed`.
- Use the existing typography roles, font families, sizes and weights. Current
  tokens use DM Sans for body/UI and Baloo 2 where the defined display roles
  specify it. Do not apply the display font to every heading or invent a scale.
- Use token colors, spacing and radii; preserve flat surfaces, heading semantics,
  field density and responsive behavior. At most two editable controls per row;
  use the shared container-responsive `FieldGrid` behavior.
- Before code changes, inspect the relevant components and installed Next.js
  guidance where available. Verify behavior and narrow/wide layouts after changes.

## Surface jobs

### Slidepanel

Handle an immediate question or bounded action while retaining the current list,
conversation or coordinating task. Start deeper work with its context intact.

Jobs: inspect the relevant schedule, record a lesson absence, review available
makeups, check last payment/current subscriptions, and initiate scheduling or an
enrollment discussion. Ordinary contact editing remains here; family membership
alone does not require a workspace.

### Staff workspace

Investigate a situation, compare alternatives, coordinate affected lessons or
people, and review consequential decisions. Open around the selected task.

Jobs: schedule a makeup, change a recurring schedule, explore alternatives to
enrollment cancellation and complete it, investigate/resolve billing, and
coordinate teacher absence.

Manage subscription also belongs in the full staff workspace. The November 4,
2026 decision and candidate capabilities are recorded in
[Manage subscription — workspace direction](odeon-subscription-management.md).
This documents future scope; it does not authorize implementing every candidate.

### Parent workspace / parent portal

Complete permitted family self-service jobs. Reuse relevant workspace capabilities
without internal tools or admin tasks; permissions must be explicit.

Agreed actions: find teachers/schedules and enroll in a new class, cancel a single
scheduled lesson, book a makeup, change a credit card, and submit an enrollment
cancellation request. Parents cannot end an enrollment directly.

## Task map

| Job | Entry / slidepanel | Workspace |
| --- | --- | --- |
| Lesson absence | Contacts search → relevant child → schedule → lesson; complete bounded absence action | Optional makeup scheduling follow-up |
| Available makeups | Balance and items; start scheduling a specific makeup | Review and schedule |
| Makeup booking | Preserve child, makeup and requested date | Compare openings and book |
| Recurring schedule change | Start from the selected enrollment | Compare alternatives with family calendar context |
| Enrollment cancellation | Start from the selected enrollment | Explore alternatives, review outcome, confirm |
| Billing status | Last payment and current subscriptions | History and details for explanation; supported issue resolution |
| Manage subscription | Selected subscription card → three-dot menu → Manage subscription; preserve account/student/subscription context | Full staff workspace owns management of the ongoing agreement; candidate scope and current prototype gap are documented separately |
| Credit-card change | Parent self-service is the agreed path | Parent portal payment-method change |
| Teacher absence | Staff → teacher; student panels available for individual cases | Teacher schedule and affected-lesson coordination |
| New class enrollment | Preserve the relevant person context | Teacher/schedule discovery and enrollment; parent capability agreed |

## Lesson absence

- Staff usually starts by searching a name in Contacts. The relevant child's
  schedule must be reachable there without opening a workspace just to cancel.
- At least 24 hours' notice: cancel that occurrence, notify the teacher, and add
  the makeup to the relevant bin.
- Under 24 hours: ordinarily record the absence/cancel the occurrence and notify
  the teacher, without granting a makeup. Staff may be lenient over the phone.
- Do not automatically change teacher pay because a student is absent. In the
  described short-notice case, a teacher already on premises is paid.
- Staff can finish after recording the absence or continue to makeup scheduling.
- Future global calendar: select a lesson block by room/instrument/teacher and
  invoke the same lesson action and policy. The global calendar is not designed
  yet and is not an additional implementation commitment in this brief.

## Makeup scheduling

- Slidepanel: answer how many makeups are available and start a specific booking.
- Workspace: preserve child, selected makeup and requested date, such as Saturday.
- One makeup becomes one replacement lesson of its original duration.
- Two 30-minute makeups may be booked as two consecutive 30-minute lessons. They
  remain separate bookings fulfilling separate items, not one combined hour.
- Default instrument/program to the original; allow it to be selected/edited.
- Offer the same teacher or any suitable teacher. Suitability after changing
  instrument/program must not imply that the original teacher teaches it.
- Keep the original lesson format for the standard flow; no agreed exception to
  combine siblings into semi-private or convert makeup items into payment credit.
- Keep the recurring enrollment unchanged.
- Makeups are scoped to the relevant child/enrollment, not a shared family pool.

## Recurring schedule changes

- Start with the requested enrollment and carry its current schedule forward.
- Prefer the same teacher on the requested day; broaden to suitable teachers.
- Keep family calendar context visible throughout comparison. Prefer sensible
  proximity to sibling lessons; an inconvenient gap is not a prohibited slot.
- Change only what was requested. A sibling's schedule is context, not permission
  to move it. Multiple children are in scope only when explicitly requested.
- Exact effective-date and future-booking handling remain to be defined.

## Enrollment cancellation and academy policies

The workspace supports discussing a different day, time, teacher or program when
the family is open to alternatives, as well as completing cancellation. Do not
make alternative exploration a mandatory obstacle when the decision is final.

Confirmed current-academy policy:

- Cancellation does not require 30 days' notice.
- The child continues attending through the last class of the month.
- Billing ends at month-end.
- Remaining makeups are forfeited when the enrollment ends.
- Staff may arrange makeups before the end; clearing the bin is not required.
- Returning later is cancellation followed by re-enrollment, not a held slot or
  automatic resumption.

Show the relevant enrollment, last class, billing end date and affected makeups
for review. Keep cancellation distinct from deleting prototype data.

Other academies may have notice periods or freezing with a defined end date.
Support policy variation without hard-coding this academy's rules universally.
Freeze slot/billing/resumption rules and configuration UI are not yet agreed.

## Teacher absence

Start in Staff: select teacher → day/week schedule and students → Mark absence →
select date → review all affected lessons/students.

Work through substitute, rescheduling and cancellation options before settling
the outcome. Contact affected families from this coordinating context or handle
cases individually. Student names can open reusable slidepanels/workspaces;
preserve the teacher-absence task when returning. Do not assume one bulk outcome
for every affected lesson or invent teacher-absence compensation/makeup rules.

## Billing

- Slidepanel: last payment and current subscriptions.
- Workspace: history and details to explain charges, plus supported resolution
  actions. Specific adjustment/refund/retry authorities and flows are not agreed.
- Parent portal: change credit card. Staff card-entry behavior is not agreed.
- Existing fictional payment/card controls are not evidence of live processing.

## Parent self-service and future SMS/AI

Parent jobs are the permitted actions listed above. Parent recurring-schedule
changes, late-notice discretion and detailed billing-resolution permissions remain
undefined. Preserve existing booking approval/payment policies; enrollment
self-service does not establish instant confirmation or override
`odeon-enrollment-decisions.md`.

Future direction: parents express these intents over SMS to an AI rather than
needing the portal. Reuse the same task rules, permissions and confirmations
across channels. An enrollment-cancellation intent submits a staff request; SMS
must not bypass that boundary. This is a direction, not authorization to implement
live messaging or autonomous transactions now.

## Shared concepts and integration boundaries

- Keep person identity, business roles, family relationships, account-manager
  responsibility, phone ownership, payer and message destination distinct.
- Multiple roles, shared phones, multiple students/instructors and adult use of
  another person's number are not inherently conflicts. Renters are not
  automatically students. Do not derive guardian status from account management.
- Preserve selected-person context even inside an account/family workspace.
- Reuse task controls across surfaces; do not duplicate schedulers, relationship
  editors or cancellation policy implementations.
- Contacts/Leads owns actual-recipient review and preview/send resolution. Reuse
  that work; do not replace it or invent consent/authorization schemas here.
- `components/contacts/ContactSlidePanel.tsx` has existing uncommitted shared work.
  Coordinate ownership and preserve it. Inspect deferred family-editor material;
  do not apply its patch wholesale.

## Next prototype boundary

Use this document to scope a task-focused prototype pass. No new implementation
order, unapproved feature set, persistence contract or live integration is implied.
Record unresolved details here before treating them as requirements. Prototype
copy must follow the constraints above rather than paste this rationale into UI.

## First task prototype — November 3, 2026

- Added local absence recording from dated lessons, with the 24-hour cutoff and
  staff-only late makeup discretion. Teacher notification is a local queue marker,
  not delivery or integration with the Contacts recipient resolver.
- Added per-enrollment makeup items and balance, plus full-page scheduling from
  a selected item. Reuses the existing pure fictional availability model, shared
  fields/panels/buttons and typography tokens. Original duration and lesson format
  stay fixed; instrument/program is editable; teacher preference is selectable.
- Booking marks exactly one makeup fulfilled and displays its replacement booking
  in the bin. Two consecutive bookings remain separate. Recurring enrollment is
  unchanged. Replacement lessons are not yet projected into the agenda/calendar.
- Parent simulation can record lesson absence and book makeups; the late override
  is staff-only. This is not server authorization or a live parent portal.
- Fixed fixture clock: November 3, 2026, noon Los Angeles. The makeup calendar opens on
  the week of November 9, using the enrollment calendar’s week navigation.
- No shared Contacts component changes in this pass. Other agreed jobs, including
  operational enrollment cancellation, recurring changes and teacher absence,
  remain unimplemented. The delete-enrollment UI has been removed; deletion is
  not a substitute for subscription cancellation.
- Tests: `scripts/academy/makeup-preview.test.cjs` and
  `scripts/security/makeup-preview-browser.cjs`. Browser harness must be local,
  blocks API/external requests, and checks 1440/900/390px. Existing older browser
  lesson-request assertions describe the previous flow and require revision.


## Review revision — November 3, 2026

- Family quick view defaults to compact enrollments, with separate Billing, Family
  and Communication tabs. Enrollment summaries show program/format, teacher,
  regular time and next lesson; no price, start date, Active badge or city.
- Lessons and makeup items expand on demand. Cancel lesson is explicit. Cancellation
  and secondary forms replace the current panel content; no stacked slidepanels.
  Deeper tasks have back-chevron navigation. Makeup scheduling remains a workspace.
- Makeup scheduling reuses enrollment’s LessonSchedule calendar with the makeup
  conflict-aware availability provider. Existing enrollment defaults are preserved.
- Removed local-demo banners and queued-notification fields from these task views.
  There is still no notification delivery, persistence or production integration.
- Revised browser regression covers tabs, compact summaries, one-dialog navigation,
  billing/card return, add-enrollment return, late and eligible cancellation,
  calendar booking, reload reset and parent late-override restriction at three widths.
- Unfinished: replacement bookings still are not normal schedule occurrences;
  subscription cancellation and enrollment editing are not implemented in this pass.

## Family/student organization update — November 3, 2026

- Contact & family is first/default. Student entry points open enrollments, makeups
  or notes already scoped to that student. Family/account surfaces retain the
  account-holder title; student task workspaces use the student's full name.
- Follow-up uses the Leads date/quick-pick/reminder/update/clear pattern and local
  account state. Existing follow-up values supplied on the preview account are
  retained. No live Leads migration or persistence has been implemented.
- Subscriptions stay compact. View lessons navigates to a chronological horizontal
  lesson timeline with a back chevron, rather than expanding a long subscription.
  Makeup bins are student-level; item entitlement remains enrollment-scoped.
- Notes have their own tab, student-specific entries and drafts. Family notes are
  not synthesized by mixing students. Parent simulation still excludes staff notes.
- Billing reuses enrollment's price-summary/line-breakdown presentation, separating
  balance, subscription billing details, payer-owned payment methods and invoices.
  Change payer is subscription-specific and leaves billing frequency unchanged.
- Invoice downloads are self-contained printable HTML documents, not PDF files or
  live invoice downloads. They contain historical invoice lines and payer snapshots.
- Verification: 245 academy tests plus six makeup tests; TypeScript and targeted
  lint; local browser journeys at 1440/900/390 including actual download content,
  follow-up retention, payer changes, note isolation and calendar booking.
- Remaining limitations from the previous review still apply, including normal
  schedule projection of replacement bookings and operational cancellation/editing.

## Individual student panels — November 3, 2026

- Student routes now project contact details, follow-up, subscriptions, lessons,
  makeup bins, notes, communications, billing lines and task forms to that student.
  No All students/sibling selector or Add child action appears on student panels.
  Sam's account route retains the family overview.
- Follow-up state is independent per student; family follow-up is retained.
- Shared invoices show only the student's lines as an Invoice breakdown with a
  Student subtotal, including the printable download. Original invoices are unchanged.
- Makeup conflict validation retains the whole family's scheduling data; recording
  a scoped absence merges lesson updates rather than removing sibling occurrences.
- Verified 247 academy tests plus six makeup tests, TypeScript, targeted lint and
  local browser journeys at 1440/900/390, including both student panels and Sam's
  family overview. Student projection is presentation, not live authorization.

## Task-focused panel refinement — November 3, 2026

- Account replaces the contact/family tab label. Student Account shows Contact
  details and independent Follow-up, without the redundant student shortcuts card.
  The family account retains its student overview.
- Enrollments & schedule opens directly to chronological lesson cards, following
  the supplied reference. Add new lesson replaces Add enrollment; View lessons
  and per-subscription Change payer controls are removed.
- Makeups use individual class blocks with instrument, duration, original lesson
  date and, when booked, replacement date/time and instructor. Student context
  is not repeated as a heading.
- Billing shows payer name and masked card details read-only. It no longer offers
  card management or per-subscription payer changes. Invoice summaries expose
  status, due date, amount, expandable lesson lines and printable HTML downloads;
  shared invoices retain student-only breakdown/subtotal semantics.
- Notes and Communication have no outer panel card. Student notes / Internal
  uses the same pressed toggle convention as message channels, with explicit
  parent-accessible versus staff-only copy. Notes retain bounded scrolling.
- Open full workspace is removed from the slide panel. Dedicated tasks such as
  scheduling makeups still use the larger task surface.
- Verified: 247 academy tests and 6 makeup tests; TypeScript, targeted ESLint and
  diff whitespace checks; browser journeys at 1440/900/390 with no browser errors
  or API requests. Journeys cover downloads, note audience separation, independent
  student follow-ups, cancellation, makeup booking and the family overview.
- These are functional local UI changes, not production integration. Payer
  identity remains in the existing model; this pass does not migrate payer data
  to a new account-level model. Replacement bookings still need projection into
  normal schedules, and enrollment editing/termination remains unfinished.

## Lesson cards and visual consistency — November 3, 2026

- Upcoming and makeup lessons reuse DenseSectionPanel with the same muted flat
  surface, 270px card width, heading scale, vertical detail spacing and status row.
  Upcoming cards lead with date, then duration, time and instructor. Makeups lead
  with instrument, then duration and allocation details; original dates are metadata.
- Scheduled/booked lessons show a green CalendarCheck badge and explicit
  "Confirmed · No action needed" copy. Unused makeups show an amber CalendarClock
  "Awaiting scheduling" badge, "Time not allocated" and an unused/allocation prompt.
  Status wording and icons supplement color; cancellation retains its own status.
- Account and Billing use shared detail fields and white detail panels; Billing
  no longer uses enrollment price-summary styling for its balance. Peer headings
  use SectionTitle's card scale, including Notes, which remains unboxed. Removed
  the redundant Notes History heading; preserved audience toggles and draft state.
- Verified 247 academy + 6 makeup tests, TypeScript, targeted ESLint and diff
  checks. Browser journeys pass at 1440/900/390, including status icons/color/copy,
  unused makeup allocation messaging, invoice downloads and student isolation.
- No persistence, payer-model migration or replacement-schedule integration is
  introduced by this presentation pass. Installed Next has no dist/docs directory;
  this pass uses existing React/UI patterns and makes no Next API changes.

## Compact cards and section actions — November 3, 2026

- Lesson cards now contain date, instructor and status, without repeating the
  recurring time/duration or helper sentences. Makeup exceptions expose their
  instrument, duration and changed time inline. Card rows no longer stretch to
  the height of their tallest sibling.
- Unused makeup cards contain instrument, service/duration and Awaiting
  scheduling, with Schedule makeup in the header. Removed original-date metadata,
  unallocated-time repetition and explanatory status sentences.
- Add new lesson, Add note and Issue invoice share a compact secondary button
  and right-aligned section toolbar position. Notes removes the audience heading
  and parent/staff description while retaining audience toggles. The shared notes
  component has an opt-in toolbar renderer; existing consumers keep their defaults.
- The local UI seeds a booked Piano makeup for Friday November 6, 2026, 2pm,
  Nina Patel. It appears in chronological order with recurring lessons. All booked
  makeups are projected once from booking state into their source enrollment's
  timeline, without altering recurring lessons or double-counting conflict data.
  Cancellation of replacement makeup bookings is not implemented or offered.
- Verified: 247 academy tests plus 7 makeup tests, including example availability
  and conflict blocking. Browser regression at 1440/900/390 covers compact cards,
  audience controls, booking projection, reload reset, downloads and student scope.
  Screenshots reviewed at 390px. TypeScript, targeted lint and diff checks pass.

## Equal lesson cards and upcoming calendar — November 3, 2026

- Lesson headers read "Piano, Private • 30 min with Jordan Vale" with the weekly
  day/time beneath. Preview cards share date, time, instructor and status rows,
  equal width/height, and an inline blue Makeup badge for replacements. No extra
  makeup-only detail row is introduced. Four upcoming cards preview each enrollment.
- Cancel this lesson is normal text color outside the cutoff and red inside
  24 hours, with a tooltip describing makeup-credit forfeiture and staff exception.
  The existing confirmation and staff exception rules remain unchanged. Replacement
  makeup cancellation is still not implemented and no cancellation action is offered.
- Makeups shows only unused credits; booked replacements remain in lesson timelines
  and the new focused View all calendar agenda, not the credit allocation tab.
- View all calendar keeps the selected student's scope (or family scope for Sam),
  combines all enrollments and replacements chronologically, supports month filtering
  and loads later dates in 91-day increments. Back returns to the original panel.
  It is a task-focused full-page agenda, not a reopened full account workspace.
- This local prototype expands explicit weekly fixture occurrences through the
  loaded horizon, preserving existing teacher overrides and cancelled occurrences,
  avoiding duplicates, and leaving one-off lessons unchanged. These generated dates
  are preview data, not live reservations or verified production availability.
- Verified 247 academy and 9 makeup/calendar tests, TypeScript, targeted ESLint
  and diff checks. Browser journeys pass at 1440/900/390 with equal-card assertions,
  cutoff colors, January/April navigation, load-more, scoped back navigation, booked
  makeup exclusion, downloads and cancellation/booking regression. Readable logs:
  /tmp/odeon-calendar-browser-final.log and /tmp/odeon-calendar-academy.log.

## Compact object panels — verified 2026-11-03

- Each enrollment shows three same-sized scheduled-class cards with Previous/Next browsing. Date, time/duration, program/service, actual instructor and Scheduled state stay together. A quiet, noninteractive `Makeup lesson` badge marks lesson type separately from state. Initial Move/Cancel controls use consistent secondary styling; only the final cancellation confirmation is destructive.
- Move lesson reuses the existing availability picker and changes only the selected occurrence or replacement booking. `originalDate` prevents later calendar expansion from recreating the moved occurrence. Recurring enrollment terms remain unchanged.
- Cancelling a booked replacement restores its credit at least 24 hours ahead; within 24 hours it forfeits that credit. Replacement cancellation does not expose a staff exception control. Ordinary lesson cancellation retains its existing staff exception behavior.
- View calendar opens a month grid with date-specific class cards, month navigation and on-demand fixture expansion, rather than an unbounded agenda. After booking, View this lesson opens the booked date.
- Invoice summaries show document identity/issue month, status, total or Student subtotal, due date and document actions. Detailed payer/line items appear in View invoice. Open invoices past due are Overdue relative to the frozen November 3, 2026 preview date.
- Downloads are actual dependency-free text PDFs, not renamed HTML. They paginate long invoices and preserve student-only breakdowns. The PDF's built-in Helvetica output transliterates accented Latin characters and substitutes unsupported non-ASCII characters; it is fixture-only, not a production multilingual invoicing solution. Issue month is not claimed as a service period because fixtures do not store service periods. No payment ledger or receipt data is invented.
- Verified: 248 academy tests plus 11 makeup/calendar tests; `npx tsc --noEmit`; targeted ESLint; `git diff --check`. Browser command: `PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/makeup-preview-browser.cjs`, passed at 1440/900/390 with no browser errors or API calls. Coverage includes scoped invoice preview/PDF download, independent Sophie/Ethan views, Sam's family view, equal class dimensions, bounded preview browsing, cutoff confirmation, replacement cancellation, move confirmation, booked-credit exclusion, booking-to-calendar navigation, and Notes audience behavior.
- Logs: `/tmp/odeon-objects-academy.log`, `/tmp/odeon-objects-browser-final.log`, `/tmp/odeon-pdf-validation.log`. PDFKit successfully parsed `/tmp/odeon-invoice-document.pdf` and extracted its complete invoice text. Screenshots reviewed: `/tmp/odeon-structure-timeline-{390,900}.png`, `/tmp/odeon-structure-billing-{390,900}.png`, `/tmp/odeon-invoice-document-390.png`, `/tmp/odeon-all-calendar-390.png`.
- No persistence, live payments, notifications or production authorization added. Existing unrelated uncommitted changes were preserved; no branch operations or commits performed. Installed Next documentation directory was absent; changes use existing React/client-component patterns without introducing Next APIs.

### Shared-component correction — 2026-11-03

The earlier “hi-fi” characterization was premature: shared primitives were used but their presentation was overridden. Removed bespoke lesson badge borders, padding, colors and weights; lesson/invoice badges now use shared Badge variants/sizes. Invoice headings use SectionTitle and values/totals use FieldValue instead of manually styled strong/h2 elements. Invoice document uses default SurfacePanel padding. Calendar selection uses ControlButton kind="toggle"/selected rather than locally styled Button states; calendar/move/makeup headings use SectionTitle. Scheduling and invoice behavior was not changed.

Verified after correction: TypeScript, targeted ESLint, diff checks; 26 focused family/makeup tests; browser journeys at 1440/900/390 (log `/tmp/odeon-shared-ui-browser.log`). Reviewed regenerated mobile invoice-list, timeline and month-calendar screenshots. This is a component-alignment correction, not final visual design approval; layout composition still requires review.

### App-context and rendered-font correction — 2026-11-03

The isolated `/tmp/odeon-jtbd-lab` root did not load the root font variable, so earlier screenshots used fallback typography despite DM Sans token references. Student layout also explicitly omitted DashboardLayout and the contact list was a custom tree. These invalidated the earlier hi-fi claims.

Student layout now uses the existing DashboardLayout. ContactsTable uses the shared ResponsiveDataTable, Avatar, StatusBadge, Input, PageHeader and name ControlButtons with fictional account/student rows; no production contacts are fetched. Desktop panel width uses the shared default sizing so the shell/table remain visible behind it. This replaces the prototype-only custom tree, not the production contacts page. Table name controls retain keyboard access and individual student routing.

Local preview root now loads the project's cached DM Sans WOFF2 via next/font/local; production continues to use its unchanged next/font/google root. Local preview wraps the actual DashboardLayout rather than recreating a sidebar. Browser test mocks only explicitly listed shell endpoints and permits brand image loading; unexpected domain APIs still fail the test. CDP CSS.getPlatformFontsForNode confirms DM Sans isCustomFont with glyphCount > 0, not merely a CSS family string or document.fonts.check on an unregistered family.

Verified TypeScript, targeted ESLint, diff checks, 26 focused family/makeup tests and full journeys at 1440/900/390. Log `/tmp/odeon-app-context-browser.log`; app/table screenshots `/tmp/odeon-app-contacts-{1440,900,390}.png`; panel-in-context `/tmp/odeon-structure-timeline-1440.png`. This supersedes prior claims of zero API requests: real shell requests are intercepted with local fixture responses; no domain API calls are made. No final hi-fi sign-off claimed.

### Leads-reference composition pass — 2026-11-03

Used the supplied Leads screenshot and LeadDetailPanel implementation as the composition reference, without copying unsupported lead actions. Student drawer now uses PROFILE_PANEL_WIDTH, shared header avatar sizing (48 desktop / 36 mobile), shared Leads titleSize props (24 / 18), and an explicit scoped subtitle. Tabs are outside the content scroller. Drawer insets align header, navigation and body. Contact details and Follow-up use a two-column container layout at 760px of actual content width, reverting to a stack below it; editable FieldGrid keeps its existing 540px two-column rule.

Enrollment headings separate program identity from the service/duration/recurrence/instructor metadata. Three equal-sized cards fit the desktop container; narrow containers use a scroll-snap row. Pagination says Classes 1–3 rather than exposing fixture inventory size. Card actions and cancellation policy are unchanged. No contact edit, status mutation or unsupported communication controls added.

Verified TypeScript, targeted ESLint, diff checks, 26 family/makeup tests and browser journeys at 1440/900/390; `/tmp/odeon-polish-browser.log`. Reviewed `/tmp/odeon-consistency-account-1440.png`, `/tmp/odeon-structure-timeline-1440.png`, `/tmp/odeon-structure-timeline-390.png`. Browser sets the existing display-size preference explicitly to 16px for repeatable comparisons; equal-size assertions permit subpixel grid rounding below 1px. Production shared components and unrelated uncommitted work remain unchanged. Visual approval remains with the user.
