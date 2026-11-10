# Onboarding interaction mock — November 9, 2026

Review in the published-table/V3 host on port 3199:
`/odeon-demo/school-setup?experience=configured`.

## Implemented

- V3 cancellation confirmation distinguishes a credited cancellation from one
  without a makeup. Internal attendance storage remains unchanged.
- Integration SlidePanel enters from the right and delays header-close,
  backdrop-close and Escape owner callbacks for its exit animation. Reduced
  motion bypasses animations. Programmatic parent unmounts are not animated.
- Reusable per-lesson subscription models have plain 30/45/60-minute price fields.
  No rate multiplication is inferred. Seed private rate remains $40/30 minutes;
  45/60-minute rates must be entered. Existing billing snapshots are unchanged.
  The mock does not yet enforce coverage between service durations and attached
  plans, or feed these rates into the separate published enrollment calculator.
- Teacher editor supports contact fields, multiple assignments, maximum-level
  sliders with numbered stops, multi-select locations, and availability
  drawing/moving/resizing. Calendar blocks open a shared modal for time/day
  editing or removal; the repeated availability field list was removed.
  Overlap validation blocks saving conflicting availability. The grid currently
  spans 6am–10pm, not location-specific operating-hour constraints. It reuses
  CalendarTimeGrid with weekday-only headings. The access selector was removed;
  actual teacher authorization remains unimplemented.
- Closure editor supports arbitrary date ranges, a location scope, optional US
  federal holiday presets and an observed-date option. Presets follow OPM's
  calendar: https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/
  These are optional school choices, not automatic closures. Local holidays
  remain custom entries. The placeholder impact-review action was removed;
  no counts, notifications, cancellations, credits or refunds are executed.

## UI correction

- Removed the preview-experience toolbar and implementation-facing instructions.
- Reused Checkbox, SectionTitle, DenseSectionPanel, ControlButton and FieldGrid
  for assignments, rates, availability and closures. Repeatable items own their
  removal action in the header; date/time pairs have at most two controls.
- Replaced the wide editable closure table with responsive entity sections.
- Existing shared calendar callers retain their default dated headers.
- Setup uses Headliner Music Academy. Closure entries only store names, dates
  and location scope; lesson treatments belong to school-wide policies.
- Closure field rows, policy boundaries, discount conditions and eligibility
  checking now have explicit vertical spacing.
- Teacher contact details, assignments and schedule are separate shared cards,
  without a surrounding form card. Assignment rows reserve their checked height.
  Lesson prices explicitly display USD.

## Dated teacher scheduling

### Weekly carry-forward update

Time off uses **Add Time Off**, an **Add time off** creation modal and an
**Edit time off** editing modal. No name or medical description is requested.
An optional `sickLeave` boolean classifies the absence; missing values in older
entries mean ordinary time off. Legacy names are tolerated but are no longer
displayed. Calendar labels are generated as Time off or Sick leave. Both types
subtract the same inclusive date range/all-day or partial hours from availability;
neither alters the weekly schedule or moves existing bookings. The checkbox is
classification only, not approval, a payroll instruction, an accrued balance or
a record of hours actually worked. Later integration must define access to this
staff-only classification, affected-lesson review and notifications (without
exposing the sick-leave reason to students), and reconcile leave usage with the
school's authoritative leave/payroll records rather than counting calendar days
or the calendar's displayed all-day span as paid leave hours.

The calendar no longer asks which scope a change applies to. Editing availability
saves a complete seven-day schedule effective from the displayed week's Monday,
in `availabilityWeeks` (`{ week: YYYY-MM-DD, blocks: TeacherAvailability[] }[]`).
The latest effective week supplies availability until another saved week begins.
An empty block list explicitly closes that week and subsequent weeks; it does not
fall back to the original schedule. Earlier weeks and already-edited later weeks
remain unchanged. `availability` remains the fallback before the first saved week.
Time off is still date-specific and subtracts from the effective weekly hours.
Legacy date overrides remain readable; saving a week replaces any legacy overrides
within that week. The old date/weekly scope controls are removed.

Downstream booking/enrollment consumers must select the effective weekly schedule
for **each occurrence date** before applying date overrides, time off, closures,
protected breaks and existing bookings. Do not use the original baseline alone.
Weekly changes never move or cancel existing lessons; future integration must
identify affected bookings for explicit review. These fields remain in-memory:
save/reopen within setup retains them, but reload does not persist them.

This update changes calendar scope only. The existing rest/meal duration inputs
are not take/waive authorization and must not be treated as break enforcement.
School-policy interpretation, authorized waivers, whole-workday accounting,
protected-time placement and payroll treatment still require separate integration
decisions. Shared enforcement must cover staff bookings, enrollment, recurring
subscriptions, makeups, reschedules and automation; validate each recurrence and
recheck atomically at commit to prevent concurrent bookings using protected time.
Persist policy/schedule versions and historical snapshots; provide explicit
conflict review and notifications without silently moving existing lessons.

TeacherSchedule reuses the shared week toolbar, calendar and modal components.
Legacy behaviour (superseded by the weekly carry-forward update above):
Recurring weekday availability was the baseline. Date overrides replace
one date's availability (including an empty day); Restore weekly removes that
override. Calendar drawing, moving, resizing and modal edits explicitly target
This date only or Every week. Time off has an inclusive date range and either
all-day or partial hours; effective availability subtracts those hours without
changing the underlying recurring or date-specific blocks. Time off stays
visible on each affected calendar date and can be edited or removed there.

Rest-break preferences are 10 or 30 minutes; meal-break preferences are separate
30/45/60-minute settings. These are saved preferences only: no automatic break
placement, work-hour tracking, wage classification or compliance enforcement.
California DIR rest/meal FAQs distinguish paid rest from meal periods:
https://www.dir.ca.gov/dlse/FAQ_RestPeriods.htm
https://www.dir.ca.gov/dlse/FAQ_MealPeriods.htm
Longer preferred rest periods must not replace separately required rest or meal
opportunities. Applicable exemptions/waivers require school legal review.

Existing booked lessons are unchanged. Affected-booking calculation, warnings
and resolution workflow remain follow-up work; this UI does not check them.
Data remains in memory in this host and resets on reload.

Validation logs: `/tmp/odeon-dated-{tests,ts,lint,browser,regression}.log`.

## Next review

### School-policy handoff — November 9, 2026

Next session: review school policies before wiring enforcement. This is a gap
checklist, not a claim that these behaviours are implemented or approved:

- Student cancellations, notice cutoffs, no-shows and late arrivals; eligibility,
  expiry, limits and transferability of makeups; distinguish credits from refunds.
- Teacher cancellations, sick leave and substitutes; who reviews affected lessons,
  which remedies are offered and who approves and notifies families.
- School closures by location, holiday/observed dates and emergency closures;
  treatment of prepaid lessons versus unbilled dates and recurring subscriptions.
- Enrollment start/end dates, pauses, withdrawals, billing/proration, deposits,
  fees, discounts/stacking and grandfathered subscription terms.
- Scheduling limits, locations/rooms, capacity, travel buffers, minimum notice,
  rescheduling deadlines, waitlists and recurring exceptions.
- Rest and meal policy: resolve take/waive preferences versus required protected
  time, authorized waiver records, work-duration accounting and placement. Current
  duration selectors do not implement the discussed take/waive policy. Retrieve
  the original policy attachment before treating earlier interpretations as final.
- Separate leave classification, leave balances and payroll; confirm which
  decisions require school approval or legal/payroll review.
- For each policy: scope, defaults, overrides/permissions, effective date,
  historical snapshots, affected-booking review, audit trail, notifications,
  persistence and shared enforcement across every booking entry point.

Latest checkpoint validation: 32 setup/demo tests passed; published-host
TypeScript, targeted lint and diff whitespace checks passed; onboarding and
published Contacts/V3/enrollment browser suites passed at 1440px and 390px.
Logs: `/tmp/odeon-timeoff-{tests,ts,lint,browser,regression}.log`.

1. Approve explicit 45/60-minute rates; validate service/plan duration coverage.
2. Teacher access: own profile vs admin assignment editing; approval workflow
   for schedule changes; location hours and conflicting booked lessons.
3. Closure impact engine: affected lessons/locations, already paid vs unbilled
   dates, chosen makeup/account credit/refund treatment, duplicate prevention,
   notifications and an explicit final confirmation.
4. Persistence, authorization and live billing are separate implementation
   work, not implied by these local UI mocks.

Validation after UI correction: 28 setup/demo unit tests passed; issuer-scoped
TypeScript and targeted lint passed. Onboarding save flows and page-overflow/copy
checks passed at 1440px and 390px. Desktop pointer drawing, moving and resizing
were checked against the resulting editable times. The published-table/V3 and
enrollment regression suite passed at both widths. This correction did not
rerun computed entry/exit animation checks.

Logs: `/tmp/odeon-onboarding-correction-{tests,ts,lint,browser,regression}.log`.

Follow-up refinement logs:
`/tmp/odeon-onboarding-refinement-{tests,ts,lint,browser,regression}.log`.
The browser checks cover fixed price fields, removed availability lists,
calendar draw/move/resize and modal removal, Headliner location options,
discount/closure row spacing, and saving at desktop/mobile widths.