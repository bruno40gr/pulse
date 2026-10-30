# Staff enrollment screen

Open `/content-studio-prototype/enrollment` on the development server while signed in as an account administrator. It uses the existing prototype-area access checks and stays outside the dashboard layout.

## Current workflow

Staff handle phone calls and walk-ins. They register a student, add parents or guardians and dependents where needed, add a subscription, choose a teacher and slot, and then take payment details. Inbound booking requests and approval are parked.

## Screen

1. Enter the signup contact first, then students. “Classes are for this person” reuses the same person identity for an adult learner. Otherwise add each student and choose their relationship to the contact (including Child). Additional students retain individual identities. Self-enrollment is checked by default and its redundant relationship field is hidden. Every person editor uses an unchecked existing-student/lead lookup toggle. There is no separate Students heading or Enrollment sidebar. The initial draft has no lessons, so the sidebar is empty until Family is completed. Lesson defaults are created only when continuing to Lessons. The contact is the default responsible adult for the local flow, not a verified guardian or a canonical relationship write.
2. Set instrument, cadence (Weekly or One lesson), and length (30 or 60 minutes) for each student. Each student automatically gets a lesson without a student dropdown. Additional lessons show a student dropdown when there are multiple students; staff must choose who the lesson is for. No calendar appears in this step. Add another lesson is separated from the cards; selection uses a subtle border, not a heavy outline.
3. Choose times. Entering this step selects the first lesson, regardless of which lesson was added or edited last. Compact student lesson cards stay in a single horizontally scrollable row above the calendar, with up to four visible on desktop and fewer on smaller screens. Cards never wrap. Selected times show a small green check directly beside the date and start–end time. There are no extra navigation actions in the calendar view; select a lesson card to switch. The calendar appears on the left and the weekly family agenda on the right; the agenda stacks below on narrower screens. Select a card to arrange that lesson. One available teacher selects immediately; several open teacher choices beside the clicked time, within the calendar. Teacher preference is a vertical checkbox list to the left of the calendar, stacking above it on small screens. The previous heading and sample-schedule row are removed. Available times show start/end times and length, with no duration legend. The calendar uses fixed half-hour grid tracks. Full-hour blocks span two tracks; overlapping start options use separate lanes so half-hour starts remain available. A chosen slot is replaced by a single dark block, not another block underneath. The active lesson shows only the student name. Other booked lessons show the student, instrument and teacher’s first name, for example “Bruno Marchena, Voice with Robin.” Other family bookings remain dark while switching students. The active lesson uses a distinct dark green. Teacher checkboxes include both teachers by default; unchecking both hides available options but never family bookings. Pending multiple-teacher choices appear inline at the selected option, not below the calendar. Clicking a draft booking selects its lesson card; clicking the active booking toggles a cell-anchored overlay listing only teachers available for the instrument and booked time, followed by Clear time slot, without moving the calendar. Clicking outside or pressing Escape dismisses the overlay without changing the booking; there is no Cancel button. “Change teacher” lists teachers available at the saved time regardless of the preference filters. “Clear time” removes only the selected teacher/date/time, preserving the lesson and making that teacher available to siblings again. Alternative times remain selectable. Calendar cards reveal an icon-only trash button on hover or keyboard focus (subtle but visible on touch devices, with accessible label and tooltip) with a native confirmation naming the student and instrument and warning that removal cannot be undone. Cancel preserves the lesson. Removing a student’s last lesson returns to lesson setup, where another lesson can be added before continuing. Additional lessons are added in lesson setup only. Existing family appointments cannot be deleted. In the sample data, only Robin teaches guitar and voice, so a different time may be needed instead of a different teacher. existing family appointments are non-interactive blocks rather than buttons that do nothing. Family lessons remain visible with student names. Go back to Lessons to edit details; changing an instrument or length clears that lesson’s chosen time.
5. On the combined Pricing & payment screen, review Due today and Due on November 1, 2026. Each line shows student, instrument, duration, scheduled dates, weekday count, rate, discount, multiplication, and subtotal. An explicitly active teacher gets the saved 50% benefit on their own enrollments. A parent’s benefit does not automatically transfer.
4. Review Terms & communication before payment: an outlined scrollable website-terms summary, a required “I accept the terms and conditions” checkbox (Continue is disabled until checked), and one optional service-SMS checkbox. No person selector; the signup contact is the consenting person. Contact edits reset both choices.
Select a test card or leave payment for later. Add another payer supports a person or organization, independent of the signup contact. Save a page-memory-only draft.

Weekly keeps the existing monthly-subscription billing label internally; One lesson keeps the existing à-la-carte plan. This split does not add new recurrence or billing rules.

The screen uses fictional people, teachers and prices. New names remain in page memory. No real card data is accepted. Saving never activates an enrollment, takes payment, reserves a slot, sends a message or writes to a database. Activation, subscription billing rules and payment timing still need agreement before integration. The screen is an initial design and does not implement the full client profile, real availability, identity review or related-student benefit approval.

The calendar opens on the sample week of November 2, 2026, with weekday hours from 2–7 pm in America/Los_Angeles. Staff can move between weeks. Sample teacher working hours repeat; sample booked appointments are dated. Available times account for instrument, lesson length, teacher bookings, the student’s existing lessons and other lessons being added. Siblings can take lessons simultaneously with different teachers. A teacher cannot take two lessons at once.

Sample gap limits are 60 minutes for Jordan and 90 minutes for Robin. A proposed lesson must be within that limit of an existing lesson on the teacher’s day. An empty day can start with any in-hours lesson. These are demonstration values and a proposed meaning of the rule, not confirmed teacher settings. A full implementation needs each teacher’s actual limits, empty-day policy, working blocks and recurrence handling. Existing long gaps are not repaired or used to reject unrelated existing bookings. The first date is rechecked when continuing. Future occurrences are not validated across a series.

Choosing a slot sets the first lesson date, time and teacher. Rooms, travel time and real reservations remain unimplemented. The family list does not represent a parent’s personal calendar or declared availability. Pricing uses each lesson’s student; teacher benefits are not transferred to siblings.

Monthly subscription currently represents weekly lessons with a monthly billing label in this design. The local billing preview uses October 27, 2026 as its fixed enrollment date. The proposed rule bills weekly lessons monthly on the 1st using actual scheduled occurrences, not a fixed four-week or annualized rate. Due today includes the remaining current-month lessons from the selected start date, plus one-off lessons even if booked in a later month. The next invoice counts next-month occurrences from each selected start date. Partial months are prorated by lesson count; discounts apply per student before multiplication. Holidays, cancellations, taxes, credits, and future recurrence availability are not modeled. This is a proposed calculation for review, not an approved billing policy or real invoice; actual subscription creation remains unimplemented. À-la-carte selections represent individual dated lessons. Converted-lead and existing-student entry points are not connected to this local screen; those future entry points should supply known people and bypass repeated data entry.

## Language

Keep labels short and use plain language. Show errors after an action needs them. Keep implementation notes in documentation. Avoid slogans, contrast framing, repeated warnings and explanatory text that does not help complete the current step.

## Files

- `/Users/brunowong/pulse/app/content-studio-prototype/enrollment/StaffEnrollment.tsx`
- `/Users/brunowong/pulse/app/content-studio-prototype/enrollment/page.tsx`
- `/Users/brunowong/pulse/app/content-studio-prototype/enrollment/enrollment.module.css`
- `/Users/brunowong/pulse/lib/academy-staff-enrollment.ts`
- `/Users/brunowong/pulse/lib/academy-enrollment-schedule.ts`
- `/Users/brunowong/pulse/lib/academy-enrollment-pricing.ts`
- `/Users/brunowong/pulse/app/content-studio-prototype/enrollment/LessonSchedule.tsx`
- `/Users/brunowong/pulse/scripts/academy/staff-enrollment.test.cjs`

The installed Next.js package has no `node_modules/next/dist/docs/` directory. This screen follows the existing prototype page and client component structure. No new dependencies or access changes were introduced.

## Checks

The academy suite passed 201 tests. Enrollment checks include existing-student checkbox and result selection, exhaustive displayed one-hour-option click checks, booked-lesson switching, teacher reassignment freeing sibling availability, clear-time recovery, filtered/conflicting teacher edits, scheduling deletion guard and Back navigation, default person fields, change and blur interactions, automatic lessons for each student, separate lesson-details and scheduling steps, scheduling and save validation, student-card selection, per-student pricing, always-visible teacher filtering, additional-lesson student assignment, name-only booked blocks, proportional full-hour grid spans, checkbox filtering, third-party payer validation and save interactions, date-count billing previews, immediate single-teacher slot selection, multiple-teacher choices at a time, named family lessons, gap limits and simultaneous sibling lessons with separate teachers. TypeScript, targeted ESLint and whitespace checks passed. No interactive browser or visual review was performed.

## Terms and communication prototype

Website source: https://www.headlinermusicacademy.com/terms-and-conditions (website last updated August 11, 2026). The screen shows a concise summary with a full-terms link. Photography-for-marketing permission is a proposed addition, not existing website language. The website describes independent optional service and marketing SMS permissions; the simplified screen offers service SMS only, not marketing SMS authorization. The website also contains a broader communication clause; approved production wording must reconcile this with its explicit SMS opt-ins. This is not legal approval or a live acceptance record.

This remains the administrator-access staff-assisted prototype, not a public booking route. A future self-service variant may reuse components but requires its own identity, authority, consent evidence and request/approval integration. Contact/relationship edits do not write canonical family relationships or operational messaging permissions. Production acceptance needs versioned terms, scope, signer authority, capture method, timestamps and withdrawal handling.


## Latest layout refinement

Self-enrollment does not repeat the contact name under Student 1. Lesson setup separates Service (Private, Semi-private, Group) from Program: the existing twelve named instrument options for Private/Semi-private, or Tiny Keys, Little Rockers and Band Program for Group. Service/program edits clear the saved slot. Only private availability is modeled; semi-private partner matching and group-session capacity are explicitly unavailable, not simulated as private bookings. Other instrument choices without fictional teacher coverage likewise need real scheduling data.

Scheduling uses the same 1050px page container as other steps, with internal horizontal calendar scrolling as needed. Teacher filters and the repeated weekly family agenda are removed; teacher information is read-only below the grid. Family bookings remain visible in calendar blocks.

Pricing & payment uses one heading, dated totals and expandable lesson/date/discount breakdowns. No “Paid by” statement. The payer selector and add-payer action share a spaced row. The Credit card heading is followed by Add payment later, then the sample credit-card fields. Fields are read-only fictional values and are never placed in enrollment state, saved drafts, logs or provider requests. This is not a usable payment collection form; production must use provider-hosted fields. Local saves remain draft-only.


## Lesson assignment and payment deferral

Additional-lesson student dropdowns include the main signup contact, even if they did not select self-enrollment in Family. Assigning a lesson to that contact adds them to the local learner projection with the same person ID, not a copied identity or canonical role write; deleting their last lesson removes that inferred learner. Every lesson card has an icon-only trash action in its top-right header. Removal requires confirmation in both setup and scheduling; deleting all lessons in setup leaves Add another lesson available and blocks Continue until replaced.

Payment is ordered Credit card heading, unchecked Add payment later checkbox, then sample card fields. Checking hides the fields and records deferral; unchecking restores the read-only sample fields. The preview instruction sentence is removed; no real card data is captured.

Family student sections have a complete bordered card around their heading and controls. The scheduling step labels its read-only teacher information with a Teacher availability h3. These are prototype UI refinements; consolidating the repeated card/header patterns into existing shared UI primitives remains a separate next step, not a completed component migration.

The final Pricing & payment step begins with one compact gray review card per lesson, reusing the Family person-card style. Each shows learner, service/program, weekday and start–end time, teacher, cadence and first date. It is final-step-only; the persistent sidebar remains removed.

## Shared-component audit — awaiting decisions

- Student card/header/actions: reuse `components/ui/DenseSectionPanel.tsx`; pass an h3 title node to preserve nested heading semantics. Its existing SurfacePanel backing introduces a shadow and token-based spacing; decide whether enrollment adopts those defaults or the shared panel gains a flat variant. Do not create a parallel enrollment card primitive.
- Gray contact and final review cards: `components/ui/SurfacePanel.tsx` with `tone="muted"` already uses the exact `colors.surfaceMuted` gray. Current prototype cards are flat/borderless; shared defaults include a border/shadow. Prefer one shared flat treatment if retaining that appearance.
- Inputs/selects: reuse `components/ui/Input.tsx` and `Select.tsx` after addressing their unassociated optional labels and removed default focus outline. Prefer consistent label association, visible focus, and caret spacing in these existing primitives rather than a second field system. Enrollment currently uses native controls with wrapping labels; migrating should preserve those accessible names and behavior.
- Read-only `FieldRow`, `DetailField`, and `FieldLabel` are display primitives, not replacements for accessible editable form fields. `CompactMetaCard` is an inline metadata chip rather than a form/review panel.
- Pricing expansion: reuse `components/ui/Disclosure.tsx`, which already supplies native details semantics and a consistent chevron.
- Icon-only removal actions: reuse `components/ui/ControlButton.tsx` with `kind="icon"`, retaining confirmation and explicit accessible labels.
- Keep identity lookup, lesson assignment, pricing calculations, and calendar behavior domain-specific; no new generic components are proposed for them.

The enrollment-only caret fix explicitly insets a decorative arrow 12px from the right and reserves 38px for it, retaining native select interaction and native arrows in forced-color mode. The shared Select and other app screens are unchanged pending the component decisions above. Browser visual verification remains outstanding.

Audit/caret validation: 202 academy tests passed, along with TypeScript, targeted ESLint and whitespace checks. The local enrollment route responds with HTTP 307 (redirect), so this is not authenticated browser verification.

### Interactive comparison page

`/content-studio-prototype/enrollment/ui-preview` compares current enrollment CSS, real shared component defaults, and a proposed flat treatment side by side (stacked on narrower screens). It uses DenseSectionPanel, SurfacePanel, Input, Select, Disclosure and ControlButton directly; the proposed flat panels, 42px fields, focus outline and 12px caret inset are preview-local overrides, not new shared APIs. Each column has independent name/program/self-enrollment controls, confirmed sample removal/restoration and expandable pricing. Fictional values are page-memory-only; preferences are not saved. The existing admin-only middleware protects this nested route without any authentication changes.

Preview validation: 203 academy tests passed, including treatment coverage, dropdown changes and remove/cancel/restore behavior. TypeScript, targeted ESLint and whitespace checks passed. Unauthenticated local HTTP returns 307 as expected; authenticated visual/browser review remains outstanding. The requested Next.js local docs directory is absent in this installation; the route follows the existing enrollment page convention.

### Approved flat treatment adoption

The flat comparison is approved. `DenseSectionPanel` now defaults flat with h3 string titles, an explicit raised alternative, and header actions. `SurfacePanel` exposes `appearance="flat"`; muted flat summaries are borderless. Enrollment Family student cards and gray contact/review surfaces reuse these primitives, and editable field groups use `FieldGrid`. The custom scheduling cards retain their selection/booking semantics.

Lead/contact profiles and add/edit-lead forms adopt the same presentation patterns. The permanent heading, grouping, dropdown-density and boxing rules are in `docs/ui-layout-rules.md` and referenced by AGENTS.md. Shared Input, Select and Textarea now associate labels and supporting messages, preserve visible focus, and share the inset native-select caret. The preview reflects the promoted shared treatment rather than claiming these accessibility improvements are still pending.

Validation after adoption: 203 academy tests and 115 focused UI/lead regression tests passed. TypeScript and whitespace checks passed; targeted ESLint reported zero errors and 37 unused-variable warnings in the existing large lead/contact files. Authenticated browser and visual review at different panel widths remain outstanding. No API, canonical identity, consent, booking, payment or messaging behavior was changed.
