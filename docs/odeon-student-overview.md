# Connected family/account workspace — October 30, 2026

## Task definition update — November 3, 2026

Read [Panel JTBD and prototype brief](odeon-panel-jtbd.md) before the next
prototype pass. It records the owner-agreed slidepanel, staff workspace and
parent portal jobs, academy policies, open decisions and required copy/design
constraints. The sections below describe the existing prototype; they are not
evidence that the newly agreed workflows are implemented.

## Review

### Subscription management direction — November 4, 2026

The agreed destination for **⋯ → Manage subscription** is the full staff
workspace, preserving the selected account, student and subscription. See
[Manage subscription — workspace direction](odeon-subscription-management.md)
for potential capabilities and boundaries. The current local drawer-based
management view is an interim prototype, not that workspace handoff. This is a
documentation-only decision; the older prototype descriptions below are not
evidence that the future management capabilities exist.

`http://localhost:3100/content-studio-prototype/students`

Contacts shows account holders above indented child rows. Clicking anywhere on
Sam, Sophie or Ethan opens Sam's family quick view; Enter/Space also opens it.
Arrow Up/Down and Home/End move between rows; Left/Right collapse/expand child
rows. Self-paying adults occupy a single account-holder/student row.

This supersedes the student-by-student and nested-enrollment explorations. The
full workspace is its own destination, not Dashboard content. No production
navigation, canonical family linkage or permanent profile URL is established.

## Information architecture

- **Quick view:** the existing `ContactSlidePanel`, with no primary tabs. Left:
  Contact & family → Enrollments & schedule → Billing. Right: bounded Notes /
  Internal notes, with an explicit family/student subject. Narrow screens stack.
- **Enrollments:** expanded immediately, showing child/program, status, service,
  duration, cadence, teacher, regular time, start, price and dated upcoming lessons.
  No View/Selected action, second detail layer, detached terms card, nested
  scheduling/payment tabs, “agreed price” or “payment arrangement” copy.
- **Full workspace:** one account/family context, with Family, Enrollments &
  schedule, Billing and Communication. Siblings are not links to separate pages.
  Enrollment details and combined week calendar are alternative presentations
  inside the same destination. Billing information is not duplicated inside
  enrollment cards. Notes live beside family context, without repeated titles
  or the staff-only explanatory sentence.
- **Billing:** account-scoped invoices with explicit payer and per-child/program
  lines; payer-specific saved cards. Quick view shows the latest two invoices,
  full Billing shows all. Fictional open and paid invoices are seeded. Four
  lessons per line is an explicit fixture quantity, not a calculated monthly rule.

## Local management actions (both staff expressions)

- **Add child:** reuses the enrollment flow's `PersonPicker`; preserves contact
  fields and adds an empty child under the existing holder. Does not enroll them
  or grant parent access automatically.
- **Add enrollment:** adapts lesson/student/program/duration/cadence/price/payer
  fields, then reuses `LessonSchedule` for sample time/teacher selection. Private,
  semi-private and scheduled group sessions use fictional availability. Current connected-family conflicts,
  live availability, consent capture and live bookings are not enforced.
- **Delete enrollment:** explicit confirmation; removes only that enrollment and
  its sample lessons. Cancel leaves it untouched. Invoice line snapshots remain.
  This is not an operational cancellation/credit/refund policy.
- **Edit payment:** select enrollment, payer and billing frequency. The payer's
  default card supplies its payment method; historical invoices retain their payer.
- **Manage cards:** add Visa/Mastercard demo presets, set a default per payer and
  remove cards. Removing a default promotes another card for that payer, or leaves
  “Not added”. No real card-number entry, credentials, tokens or payment processor.
- **Issue invoice:** choose one payer's enrollments, explicit quantity and due
  date; creates an open local invoice with frozen line prices and student IDs.
  No sending, charging, automatic proration or duplicate-period billing policy.

Account membership and payer are deliberately separate. Sam pays for the Kim
fixtures; payment editing can demonstrate split billing without moving a child
between accounts. This is a design model, not a settled production billing or
access-control contract.

## Scenarios and state

- Sophie: weekly piano with Jordan, weekly voice with Robin; Ethan: Friday guitar
  with Robin. Sam is their account holder and initial payer.
- November 10 piano uses substitute Casey; Jordan remains the recurring teacher.
- Alex is a self-paying adult with concurrent weekly/one-off enrollments; Mia
  has no enrollments. New children can be added in the staff simulation.
- Lesson drawers record one-occurrence pending reschedule/cancel requests only.
  They do not change occurrences, future lessons, enrollment or billing.
- Account/section/calendar/week restore from URL and browser history. Older
  student URLs resolve to their family account. Notes/drafts/actions/requests
  remain in memory and reset on reload; no browser or backend persistence.

## Isolation and parent simulation

- Development-only route, existing server owner/admin authorization and prototype
  middleware. Parent preview is an admin simulation, never a security boundary.
- Contact adapter requires development mode, explicit adapter and `preview:` ID.
  Existing live contact behavior, tabs and funding remain on their original path.
- Parent projection explicitly permits Sophie/Ethan only; added children need
  future access grants. Unrelated account/student URLs fail closed. Staff notes
  and staff management controls are not rendered.
- Parent billing includes only Sam's invoices whose line student IDs are all
  allowed, and Sam's cards. Historical invoices survive enrollment deletion.
  Family membership is not treated as permission to see another payer's billing.
- Deferred: canonical linkage, durable writes, actual access grants, real payment
  integration, invoice lifecycle/delivery, conflict authority, consent/policies,
  timezone authority, cancellation/credits and family messaging.

## Verification

### Enrollment follow-up

- Birthday restored in shared person entry; retained through child creation,
  enrollment draft copies and inquiry conversion. Optional, validated as a real
  non-future date. Existing records without birthdays still work.
- Payer selection removed from Family and lesson setup. Main flow chooses payer
  only in Pricing & payment; workspace add-enrollment ends with Payment.
- Calendar uses quarter-hour units: 30/45/60-minute available and booked blocks
  occupy 2/3/4 units. Available windows do not overlap, and selection replaces a
  window in place rather than moving it into a booking-only lane. Horizontal
  teacher checkboxes sit between the date range and calendar; existing bookings
  stay visible when teachers are unchecked.
- Student relationship is edited inside student details and retained in the gray
  summary alongside birthday/contact fields. Staff enrollment has four clickable
  steps: Family, Lessons, Times, Pricing & payment. Forward navigation validates
  prerequisites. Terms remain reserved for future self-enrollment; staff does not
  assert acceptance. Legacy browser drafts migrate from the former five steps.
- Tiny Keys and Little Rockers use fixed fictional 45-minute sessions; Band
  Program uses 60-minute sessions. Semi-private supports 45-minute selection and
  saving in both staff and family flows. Group starts are explicit fixtures, not
  arbitrary private availability; they reserve their teacher's time from private
  lessons. Partner matching, live capacity and real group enrollment remain deferred.
- Teachers is an H2 above the horizontal filters. Seven fictional teachers now
  cover all listed instruments/programs: Jordan Vale, Robin Ellis, Maya Chen,
  Leo Brooks, Nina Patel, Owen Reed and Zoe Williams. Five additional example drafts
  bring the mock list to 13; missing examples are merged without replacing local edits.
- Dark green/blue booking colors and duration-based open-slot colors removed;
  bookings are neutral with an explicit Editing outline/label for the active one.

- Latest follow-up run: **243 academy tests**, **25 prototype/funding/dialog regression
  tests**, TypeScript, targeted ESLint and `git diff --check` checked. See logs below
  for current counts; earlier family-workspace results are not a deployment check.
- Updated browser journeys passed at **1440/900/390px** after the family revision.
- Academy suite includes `family-preview.test.cjs`: explicit account membership,
  child/enrollment mutations, cross-account rejection, payer/card defaults,
  invoice snapshot preservation, split payer restrictions and parent projection.
- `student-preview-browser.cjs` runs actual repo components in isolated local lab
  `http://127.0.0.1:3197/students`, blocking external/API calls, at 1440/900/390px.
  Exercises tree rows/keyboard, tabless quick view, inline enrollments, child and
  enrollment creation using the real time-picker, payment/cards/invoices/deletion,
  quick/full handoff, drafts/history, parent projection, requests and reload reset.
- External Playwright via `PLAYWRIGHT_MODULE`, no new application dependency.
- Latest logs: `/tmp/odeon-rich-{tests,browser,regression,types,lint}.log`.
  Browser journeys also select/save 45-minute semi-private, Tiny Keys and Little
  Rockers, check the H2 and take a staff group draft through to payment.
  Screenshots: `/tmp/odeon-rich-{Piano,Tiny-Keys,Little-Rockers}-{1440,900,390}.png`.
- Earlier logs: `/tmp/odeon-quarter-{tests,browser,regression,types,lint}.log`.
  Browser checks compare proportional 30/45/60 heights and exact pre/post-selection
  geometry at all three widths. Screenshots: `/tmp/odeon-calendar-quarter-{1440,900,390}.png`.
- Earlier screenshots:
  `/tmp/odeon-family-{contacts,quick,enrollments,billing,parent}-{1440,900,390}.png`.
- Installed Next 15.5.22 has no `node_modules/next/dist/docs/`; existing patterns
  and installed declarations were inspected. No new routing API introduced.
- Isolated lab is not an authenticated intended-app browser check or production
  build. No commit, push or deployment. Original `/Users/brunowong/pulse` untouched.