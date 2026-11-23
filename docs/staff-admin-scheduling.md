# Staff scheduling: Admin work and responsibilities

Decision date: November 22, 2026.
Status: agreed product requirements; not a claim of implementation or deployment.

## One school-setup foundation

Reuse School Setup's existing staff, qualifications, locations, availability and
scheduling rules. Do not introduce a parallel staff directory or per-availability
service qualification list. Teaching eligibility continues to come from the
teacher's service/instrument assignments and maximum teaching levels.

## Admin is work, not unavailability

- Non-teaching work is scheduled under the **Admin** work category.
- Responsibilities describe the work within Admin. Front desk is a responsibility,
  not a separate top-level category alongside Admin.
- Example responsibilities: Front desk, Opening, Closing, Event setup, Event
  takedown, Sales and Marketing. These are examples, not a fixed or required list.
- An admin-only staff member can have a work schedule without any teaching
  assignment. They must never become student-bookable merely because they have
  working hours or free calendar space.
- Admin work eligibility and application administrator permissions are separate.
  Scheduling Admin work never grants application permissions.

## Configure responsibilities in school onboarding/setup

The school can add and edit its Admin responsibilities in the existing School
Setup experience. Responsibilities are school-owned configuration, not hardcoded
calendar choices or a new standalone settings surface.

Preserve historical assignment meaning when responsibilities change. Archiving
unused responsibilities rather than deleting historical references is the
recommended implementation approach; rename/history behavior remains to be
specified. Do not infer new per-responsibility qualifications or pay rates from
this decision.

## Calendar assignment semantics

An Admin assignment identifies the staff member, date/time, location,
responsibility and optional notes. It represents scheduled non-teaching work:

- It occupies the staff member's time and prevents overlapping assignments.
- It is not available for student booking, and requires no teaching qualification.
- It does not automatically reserve a teaching room. A room reservation, if
  explicitly requested, remains subject to the existing resource rules.
- Scheduled work, confirmed worked time, approved payable time and paid time are
  distinct states. Do not mark scheduled hours as attended, approved or paid.
- Actual absence and leave remain separate from Admin work. Sick leave is not an
  Admin responsibility merely because a legacy system stored both as unavailable.

Assignments must execute sequentially. Replacement for one occurrence versus
future recurrence must be explicit; never combine conflicting alternatives into
one longer shift or count duplicate work twice.

## Scheduling increments and breaks

- Keep the existing scheduling intervals. Do not add 15-minute scheduling controls
  for staff work in this promotion; finer timing is deferred for possible review.
- Do not use quarter-hour timestamps in historical source data as a reason to
  change the product's scheduling intervals.
- Do not silently round historical times or alter their durations. Retain source
  evidence and flag incompatible times for an explicit import decision.
- Preserve the machine-enforced four-hour teaching threshold and mandatory
  **10-minute break**. Do not make the fixed break casually editable.
- Admin work is not rest and cannot satisfy the mandatory break.
- Existing implementation reserves a whole half-hour opening. Representing a
  protected 10-minute break plus 20 minutes of Admin within it remains unresolved
  under the retained scheduling intervals. Do not imply finer-time editor support
  exists or remove break protection to accommodate Admin.
- An unexplained gap is not automatically a meal break, unpaid time or rest.
  Separate applicability of break policies to admin-only shifts is not decided
  here; do not infer it from the teaching rule or historical gaps.

## Cohen Rodin: legacy-source interpretation

The user identifies Cohen as admin-only. Opus unavailable entries labelled Admin
represent its workaround for non-teaching work, not true absence. The supplied
screenshot shows compensation enabled at $22/hour for that displayed entry;
it does not establish a universal or current rate.

The pasted dated entries span May 28 through November 18, 2026. They are
historical source evidence, not an authoritative current recurring schedule.
Repeated weekday entries include duplicates and conflicting alternatives. Their
display order does not establish effective dates or precedence. A date-specific
entry does not establish whether it replaces a whole day, one shift, or adds work.
Confirm replacement scope before importing. Keep R/O unclassified until its
meaning is confirmed; preserve explicit sick-hour notes as leave source evidence.

No Cohen records or hours have been imported by documenting this decision.

## Implementation and release boundary

The existing implementation has separate `admin` and `front-desk` duty kinds and
capability fields. Those describe current behavior, not the agreed target model.
Reconcile them with Admin plus school-configured responsibilities without losing
historical assignments. Do not claim the responsibility editor already exists.

A qualification-enforcement slice was implemented and tested only in
`/private/tmp/pulse-scheduling-foundation-20261122`, based on main `777eaa1`:
59 targeted tests, TypeScript and targeted lint passed. It is not merged or
deployed and is not proof of operational-calendar readiness.

Off-Beta release still requires server-authoritative scheduling checks, explicit
assignment replacement, break/admin handling compatible with retained intervals,
live-data and tenant/concurrency validation, persistence/reload checks,
authenticated desktop/mobile staff acceptance, production build and rollback
review. This documentation does not authorize migrations or customer data edits.
