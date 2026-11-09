# V3: wider profile panel with inline tasks

Opt in with `/students?prototype=v3` in the local lab, or append `prototype=v3` to the existing student-preview route. V1 remains the default; V2 remains available with `prototype=v2`.

## Layout

- Desktop width: `min(calc(75vw + 200px), 1160px)`, versus V2's `min(75vw, 960px)`. Mobile/tablet retains the existing full-screen presentation at the shared mobile breakpoint.
- One persistent SlidePanel owns profile identity, Close, contact actions, section navigation, and scrollable content. No task-triggered full-screen workspace replacement.
- Account, Notes, Schedule & lessons, Billing, and Makeups are available inside the panel. The redundant View Account Details CTA is omitted.
- Calendar, move lesson, makeup booking, subscription management, and other management forms reuse AccountWorkspace in inline mode: a content Back/title row without a second profile identity.
- Upcoming lessons uses a stable Schedule & lessons heading and a List/Calendar toggle retaining the selected week. Browsing and rescheduling share CalendarWeekToolbar beneath their title row, with matching placement, styling and range; the week range is never used as the screen title. The calendar occupies the content width without Lessons or Select a lesson sidebar cards. Selecting a scheduled block immediately opens Move/Cancel actions. Every scheduled block also has a persistent top-right three-dot trigger.
- Reschedule lesson opens calendar availability from either view and returns to Calendar after confirm/back. The original lesson remains a labeled slate booked block; available times are neutral dashed blocks, and the selected replacement is blue. Move availability enters with a gentle horizontal slide (disabled for reduced motion). No Only this lesson changes card. Weekend reference lessons remain visible.
- Makeup booking keeps the Makeups tab selected throughout booking and returns to that bin. It uses the same availability calendar and selected replacement treatment. Calendar first on the left, narrow booking controls on the right: disabled-until-selected confirmation aligned with the calendar grid (not the date toolbar), Same teacher checkbox (checked initially), then a vertical teacher list when unchecked. The legend sits below the calendar. On narrow mobile containers, controls follow the calendar. Instrument controls and the redundant checked-teacher name are hidden. The move action is labeled Reschedule this lesson. Tabs leave either booking task without saving. Moving preserves the instrument as required by the domain model; recurring subscription schedule changes are available from Manage subscription and the single-lesson reschedule shortcut.
- Calendar grids scroll within their own surface, never by overflowing the panel. The active tab scrolls into view on narrow screens; entering an inline task brings its heading into view.
- Invoice viewing/payment semantics, medium buttons, non-sticky invoice actions, payer ownership, and custom invoice details are unchanged. Payment confirmation remains a compact nested dialog.
- Preview state is local only; nothing charges a card or persists to a backend. Parent preview remains read-only.
- SectionHeader owns the navigation/title/action slots across sections and tasks. V3 titles start at the content edge, Back immediately precedes task titles, and no empty navigation column is reserved; makeup-bin student names use this same header; panel-owned scroll reset preserves the same top inset. Browser tests compare title origins and assert zero entry scroll at every tested width.

## Implementation

StudentWorkspaceV3 enables an inline task context and an opt-in mode in the shared V2 implementation. Defaults preserve V2 navigation and workspace presentation. Shared task forms and mutations are not copied.

## Validation

From `/Users/brunowong/pulse-odeon-integration`:

```sh
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/student-workspace-v3-browser.cjs
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/student-workspace-v2-browser.cjs
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/billing-preview-browser.cjs
node --test scripts/academy/*.test.cjs scripts/security/dialog-stack.test.cjs
npx tsc --noEmit
git diff --check
```

V3 browser coverage runs at 1440, 1366, 1100, 900, and 390px. It verifies width, persistent panel DOM, single profile identity, retained tabs, contained overflow, calendar selection, confirmed lesson move, subscription save, confirmed makeup booking, invoice viewing/payment, invoice issue form, lesson cancellation, messaging return, and retained contacts search/selection. Domain APIs are blocked; browser exceptions fail the journey.

Billing coverage includes V1/V2/V3 at desktop and mobile widths, PDF downloads, custom fields/notes, payer-owned cards, paid state, and atomic Pay all. Review images are `/tmp/odeon-v3-{account,calendar,move,subscription,makeup,invoice}-{width}.png`.

## Recurring schedule changes

- V3 Manage subscription → Change recurring schedule opens the shared booking calendar with Apply to all upcoming lessons checked. The single regular-lesson move flow offers this checkbox unchecked. Makeup credits/bookings and one-off subscriptions do not offer recurring scope.
- Selecting recurring scope changes the action to Change recurring schedule. Before applying, Confirm recurring schedule change summarizes the student, subscription, new weekly teacher/time, original lesson cutoff and new first date. Cancel leaves the draft and subscription unchanged.
- Validation uses all students/subscriptions in the local fixture (not only the visible student), teacher teaching hours and scheduled sessions, makeup bookings and a minimum 52-week horizon extended to all currently loaded lessons. Conflicts block the entire change; no partial update occurs. This is a finite local preview, not a permanent/live availability guarantee.
- Confirm updates subscription teacher/day/time plus upcoming scheduled regular occurrences from the original occurrence onward. Past lessons, cancelled/absent occurrences, makeup credits/bookings and invoices stay unchanged. Stable original occurrence dates prevent duplicates, preserve schedule-change segments and retain the new schedule when expanding the calendar later.
- Conflict copy: “This teacher is available for the selected lesson, but not for every upcoming lesson at this time. Choose another time or teacher to change the recurring schedule, or reschedule this lesson only.”

- V3 Manage subscription is a single vertical stack. Change recurring schedule lives in the subscription summary header actions. Apply to all upcoming lessons follows the teacher controls; the recurring confirmation omits the availability-horizon disclaimer (validation behavior is unchanged).

- V3 contextual task headers identify instrument and duration: Schedule Piano makeup · 30 min / Reschedule Piano lesson · 30 min. A shared subtitle identifies the makeup credit date or original lesson date/time; account-manager panels prefix the student name, student panels do not repeat it. Recurring scheduling also identifies instrument/duration. Reschedule lesson replaces Move lesson in calendar/list actions. Titles wrap naturally without separate summary cards.

- Student Billing supports individual invoice payments in a modal that explicitly identifies the student, payer and saved card. Payment-method management, billing actions and combined Pay remain account-holder-only. Child billing has no permanent banner, explanatory subtitle or account-handoff button. Missing-card guidance appears only inside the payment modal; link to the account only for a supported payer route. Sam’s Payment methods remains a secondary billing-header action and returns to Sam’s billing. Riley is a payer fixture, not a separately navigable account in this prototype.

## Parent portal exploration

- Open Preview parent portal from Contacts, or use `/students?prototype=v3&view=parent&account=preview%3Akim`. This is a development-only simulation, not a deployed parent-authentication flow.
- Parent preview uses a dedicated full-window surface with Home, Lessons and Billing navigation, rather than the staff drawer. Home shows upcoming lessons, Sophie and Ethan, available makeup credits and Sam’s own balance.
- Lessons can be filtered by child. Parents can cancel regular lessons under the existing 24-hour policy (no staff exception control), then book available makeup credits with the shared calendar. Booked makeups are listed separately.
- Billing includes only invoices assigned to Sam; Riley’s invoices and saved cards are excluded. Parents can view/download invoices, confirm local preview payments, add sample cards under a separate cardholder name, remove cards and set defaults. Payer selection is limited to Sam.
- A dedicated projection strips internal/unclassified notes, messages, follow-ups, unrelated accounts/lessons and other-payer payment details. A local action allowlist rejects staff operations and out-of-scope invoice/card mutations. Production must enforce equivalent grants on the server; this client prototype is not an authorization boundary.
- Preview data uses the existing fixed November 2026 schedule clock and Pacific time. Navigation sections survive refresh; fictional mutations reset. Exit parent preview returns to Contacts. No real charges or live parent APIs are used.

### Contact editing and relationship lifecycle

- Contact details use the shared DenseSectionPanel header action slot and FieldGrid/Input controls, with person-scoped Edit contact / Save / Cancel. The parent Account section separates the holder and each linked student into their own editable cards, including email and phone. Edits change only that person; student-panel messaging uses the selected student’s current contact details, not the holder’s. Identity updates do not rewrite invoice snapshots or change saved-card ownership.
- Saved-card removal requires the shared Modal confirmation. Default-card promotion (or having no remaining default) is disclosed before confirming; recorded payments and invoice history remain intact.
- New local notes carry a stable author ID. Only that author can edit through the existing NotesSection editor; original attribution/date and links remain, with a dated Edited marker. Legacy notes without author IDs stay read-only.
- The staff prototype runs as a fictional admin; staff relationship mutations require an explicit admin context; parent removal requires the matching holder and visible student scope in the local reducer. This is not production authorization or a role-management implementation. Parents can add a new dependent and remove their own projected family members through the scoped parent reducer; linking existing holders remains staff-only.
- A self-managed student can Add account holder: search/select an existing contact, or create a contact with duplicate-name/email checks. Confirmation explicitly makes this person primary, without changing existing invoice/subscription payer assignments, moving cards, sending invitations or granting portal access. Existing saved cards block holder replacement pending resolution. Self-service access review remains a production prerequisite.
- Manage relationships supports confirmed Unlink child, never delete. Subscriptions (including frozen/pending) and unpaid/draft invoices do not block unlinking. Choose the student or another contact as future payer; the standalone student retains subscription states, lessons and debt with unchanged due dates. Student-only invoices follow the student, retaining paid history; unpaid shared invoices are allocated by existing student lines without changing the combined balance. Shared paid invoices remain historical documents in the original account. Cards are not moved or reused, and no portal access is granted. Existing primary-holder replacement on multi-student accounts is intentionally not exposed.
- Regression checks: scripts/security/contact-editing-browser.cjs covers desktop/mobile contact cancel/save, portal geometry and CSS, confirmed card removal, existing/new holder linking, unlink with active subscriptions/overdue debt, person-scoped messaging, dependent editing and authored note editing. Existing parent and payment-method suites retain coverage across V1–V3.

### Parent self-service additions

- Home keeps its existing upcoming-lessons / balance / makeup / children distribution. Lessons adds shared List / Calendar controls and a Schedule a makeup shortcut to the credit list; booked makeups appear alongside regular lessons. Calendar week and student filter remain when returning from a scheduling task.
- Parents use the existing MoveLesson and MakeupWorkspace calendars for one-occurrence rescheduling and booking credits. Recurring-schedule changes and staff exceptions are not exposed. Availability callbacks check full local scheduling data without displaying other students. Final mutations repeat scope, conflict and eligibility checks.
- The prototype applies the existing 24-hour eligibility boundary to parent rescheduling: closer moves require staff assistance. Regular and makeup cancellations retain the existing credit-return/forfeit rules. This preview policy must be confirmed against academy policy before production rollout.
- Notes shows only entries explicitly marked with family audience, per authorized student. Unclassified legacy notes and internal lanes are excluded. Parents can add shared notes and edit only their own using stable author IDs; teacher notes are read-only. Drafts survive student switches and portal-section navigation. Staff-created shared notes and parent notes use the same local notes store. All prototype changes reset on refresh.
- `scripts/security/parent-self-service-browser.cjs` verifies Home structure, calendar filtering, late-move guidance, single-occurrence rescheduling, makeup booking/cancellation, teacher-note read-only behavior, parent note editing, draft retention, billing and reload in V1–V3 at 1440px and 390px. `scripts/security/parent-portal-browser.cjs` retains the original cancellation/payment regression journeys. These are local simulation checks, not production access control.

### Regression maintenance

- Editable contact and relationship fields use the shared Input/Select `label` prop, rather than read-only DetailField labels. Keep the native label/control association and shared two-column FieldGrid behavior.
- `scripts/security/student-preview-browser.cjs` now tests the current V1 ResponsiveDataTable: filtering, selection isolation, keyboard activation through the name control, non-interactive row-cell opening, person-scoped profiles, retained note drafts and invalid routes. It no longer asserts the retired treegrid or all-in-one family panel.
- Detailed journeys remain in the account-manager, subscription-workspace, billing-preview, account-payment-methods, parent-portal and V3 workspace browser suites; the contacts smoke test is not a replacement for those suites.
- The older `scripts/security/makeup-preview-browser.cjs` still contains stale expectations for Create statement / Issue invoice buttons on child billing and for the retired parent Schedule surface. Its broad run currently stops at the child-billing assertion; later assertions in that run are unverified. Do not restore account-holder-only controls on child billing to make this old test pass.

### Parent calendar and makeup workspace

- Parent content now uses up to 1440px while retaining Home’s lesson/summary distribution.
- The contact panel uses the balance summary treatment and derives Next payment from active monthly/per-lesson subscriptions; the November fixture’s next monthly payment is Dec 1. This is distinct from overdue invoice dates and does not promise an automatic card charge.
- Lessons exposes a shared primary Schedule a makeup (count) action, scoped to the selected child. It opens a dedicated booking calendar with a 240px left rail of selectable credit blocks and booked-makeup summaries. No duplicate credit/booked-makeup cards below the lesson calendar. Mobile stacks the rail above the calendar.
- Makeup availability still checks the full local fixture; booking rechecks parent scope and conflicts. Selecting another credit resets slot selection. Successful booking returns to lessons and updates the count.
- Rescheduling inside the prototype’s 24-hour cutoff opens the shared Staff approval required modal with a Got it action, rather than an inline alert. The cutoff still requires academy policy confirmation before production.

### Simplified parent Account

- Contact details omits the derived dependent count. Dependents has only Manage Family Group and Add Dependent section actions, followed by individual editable student cards. No open/delete-student-record action. Subscription placement is unchanged.
- Your balance starts at the top of Account’s right column with unpaid-invoice count and Next payment; amounts remain derived from the parent’s invoices.
- Manage Family Group replaces the dependent cards inline with student names, upcoming scheduled lesson counts in the loaded preview, and Remove from Family Group. That opens only the requested unlink sentence with Confirm/Cancel. Cards and debt safeguards remain reducer behavior, not explanatory UI.
- Parent-added dependents receive explicit local preview visibility. Staff-added contacts remain outside the original simulated parent scope. Removed students and their ongoing lessons/debt remain stored but disappear from the former parent’s projection. No production authorization is implied.
- Shared FieldLabel uses typography.label (0.8125rem) rather than typography.sizeXs (0.6875rem). Rem values continue respecting display-size preferences.

### V3 family overview and focused canvas

- Sam’s Contact details omits the repeated read-only name; name remains editable. The Family Group card derives dependent/subscription totals (the current fixture has 2 dependents and 3 non-cancelled subscriptions).
- Manage Family Group and + Add Dependent open the existing AccountWorkspace task canvas, replacing the profile columns while retaining the panel identity and navigation. Back restores the overview.
- Dependents group their existing subscription cards below their contact details. The right column contains Your balance then Follow ups. The Account overview omits Makeup credits; the Makeups tab remains available.
- Removal confirmation uses the compact shared Modal with ModalHeader/ModalBody/ModalFooter, explicit Confirm/Cancel, and retained dialog-stack focus/layer handling. Browser checks cover painted hit testing, compact bounds, cancel/confirm and canvas return on desktop/mobile.

### Consistent contact metadata and family task structure

- V3 main-account contact details, Family Group counts and dependent summaries share a horizontal, naturally wrapping MetadataRow. Editable fields retain FieldGrid. Main-account missing fields remain visible as Not added; dependent missing email, phone and age are omitted, including an entirely empty summary row.
- Manage Family Group uses AccountWorkspace with DenseSectionPanel member cards and header actions, matching the structure of Manage subscription. Add Dependent likewise uses a Contact details section card with header Save/Cancel-style actions. Parent flows retain their navigation and scoped mutations.

### Equal metadata columns and family membership rows

- MetadataRow uses equal-width grid tracks: two values split the width in halves, three use thirds, with a maximum of three columns. Main-account missing fields stay visible; dependent missing values remain omitted.
- Manage Family Group has Add Dependent in its task header, followed by divided name / relationship select / remove rows. No lesson counters or member cards. Narrow layouts retain name/relationship together and wrap the remove action below. Relationship edits are scoped local-preview membership metadata and do not change billing, history, or portal permissions.

### Rescheduling decision panel

- Move summary shows From/To dates, times and teachers, with a Teacher change badge when appropriate. Scope uses radios with This lesson only selected by default and a derived affected-occurrence count for series changes. Recurring changes retain the explicit confirmation and conflict checks.
- The Move action is last, sticky, disabled without a selection and labeled with the selected destination. Teacher preference changes clear the selection. Removed the no-suitable-times helper.
- Replacement calendar slots show start times only, adding teacher initials for multi-teacher choices. Hover is white/dashed; selection retains stronger blue with a solid border. Other enrollment calendar modes retain their existing slot metadata.

### Rescheduling hierarchy refinement

- Selected replacements display time and teacher, not the student name or a Selected replacement prefix. Same teacher and optional teacher selection live beside week navigation rather than in the decision rail.
- Populated To values are bold blue; the unchanged From value is neutral. The dynamic Move to action follows Scope directly with no forced-height rail or pinned-bottom spacer.
- Rescheduling uses the shared labeled Back to schedule control (wrapping above the task title on narrow panels); return state remains owned by the calling schedule.

### Reschedule slot content and selection card

- Purple reference blocks omit the Original lesson prefix. Move availability and selected blue blocks show program, teacher and compact time on separate lines (multi-teacher slots say Choose teacher until selected).
- Same teacher is checked by default beside week navigation. Unchecking removes the teacher filter and opens the existing per-slot teacher chooser on each clicked slot, including single-teacher slots. No global teacher dropdown/radios in the move workspace.
- The right rail starts with a shared flat Reschedule to card and centered Select a lesson time placeholder plus disabled Move lesson button. Selection populates program, teacher and date/time, then reveals Scope with the existing impact count/confirmation safeguards.

### Simplified move action and aligned metadata tracks

- Removed Scope, its radios and the Moves N lessons text from the move rail entirely. The CTA is always Move lesson, disabled until a slot and teacher have been selected. Ordinary rescheduling moves only the selected occurrence; the separate Change recurring schedule entry retains explicit series confirmation and conflict validation.
- MetadataRow now always uses three equal-width tracks. Two-field rows leave the final track empty, so Family Group counts align with Contact details rather than switching to halves. Browser coverage compares actual column origins and widths across the two cards.

### Account action hierarchy

- V3 Add Dependent and Add subscription both use the shared primary Button variant. Edit contact uses the lower-emphasis shared ghost variant; Save and Cancel retain existing form behavior.
- Staff and parent balance cards reuse invoiceStatus for View billing: shared red/destructive styling when the visible account has an overdue unpaid invoice, secondary otherwise. Payment, invoice ownership and visibility rules are unchanged.


### Global account editing (V3 staff)

- A single low-emphasis **Edit account** action in the top communication toolbar opens the inline account workspace. The overview no longer has a Family Group card, Manage Family Group button, Add Dependent button, or per-card Edit contact actions.
- The workspace edits the account holder first, then each dependent, with a single atomic **Save changes / Cancel** contact form. Family management is embedded below: Add Dependent, relationship changes and confirmed removal retain existing behavior. These membership actions save immediately, independently of contact drafts; the workspace explicitly explains this distinction.
- Top Call / Send SMS / Send email buttons display the active contact's values. Missing SMS/email disables that action; a dependent never inherits another person's communication values. Calling remains disabled in the fictional preview.
- Contact details use three fixed equal-width tracks: **Dependents / Member since / Birthday**. No join date exists in current fixtures, so Member since is Not added; no subscription/invoice date is substituted. An optional explicit contact memberSince value is supported.
- Dependent subscription sections remain on the read-only overview; Add subscription remains directly available. V1/V2 and parent layout behavior is not migrated.
- Validation: global-account family browser at 1440/390; V3 full workflow at 1440/1366/1100/900/390; parent-family browser at 1440/390; 273 academy tests; 17 makeup tests; TypeScript, targeted ESLint and diff whitespace checks. Inspected `/tmp/odeon-v3-global-account-{1440,390}.png` and `/tmp/odeon-v3-global-editor-390.png`.
- Existing V2 browser suite remains blocked by its old assertion for a Billing heading in the quick reference (the existing component renders Your balance). That unrelated test expectation was not changed as part of this V3 work.

### Subscription and calendar polish

- Subscription payment summaries show a compact Visa badge (generic credit-card icon for other card labels) beside `Paid by Sam with ***4242`. Missing card values remain explicit. Level uses the same shared card-heading typography as the program.
- Sam's V3 Notes tab retains account-owned notes and separately labels each dependent's student-owned notes. Sophie has practice resources and Ethan has a fictional guitar-practice note; shared fixture notes are visible through the existing family-audience projection. Student note creation/editing retains student keys, rather than copying notes into account ownership.
- Multi-teacher replacement slots say **Many teachers**. Teacher popovers are exactly their calendar block's width, allow wrapped names, and dismiss with Escape/outside clicks. Same teacher remains selected by default.
- Calendar color-key labels use equal minimum heights and inline-flex vertical centering, with a shared centerline when on one row.
- Parent weekly calendars now use the same compact lesson-block actions as V3 staff: select a lesson or use its overflow to reschedule/cancel, retaining week navigation and teacher filtering. Shared rescheduling keeps per-slot teacher selection. Parent scoping, under-24-hour staff approval, and single-lesson-only restrictions are unchanged.
- Verified: V3 full workflow at 1440/1366/1100/900/390; V3 family/account assertions at 1440/390; parent self-service across V1/V2/V3 at 1440/390; parent family at 1440/390; 273 academy tests; 17 makeup tests; TypeScript, targeted ESLint and `git diff --check`.
- Screenshot review: `/tmp/odeon-v3-global-account-1440.png`, `/tmp/odeon-v3-teacher-options-1440.png`, `/tmp/odeon-v3-family-notes-1440.png`, `/tmp/odeon-parent-teacher-options-v3-390.png`.

### Contact scoping and shared action refinements

- Toolbar action is **Edit Contact** with the shared Lucide pencil icon. Account-manager entry retains account/family editing. A dependent entry passes its exact ID, renders and submits only that contact, and has no holder/sibling fields or family-group management.
- Removed the family-membership explanatory sentence. Existing immediate membership behavior is unchanged.
- Subscription program headers have no bottom margin or extra header-to-Level gutter; Level retains matching card-heading typography.
- Notes bylines now render through shared **FieldLabel**, matching metadata label size/weight/line-height instead of an extra-small one-off. This intentionally affects all shared NotesSection consumers.
- Lesson List and Calendar toggles have leading List and Grid2X2 icons in staff and parent surfaces. Accessible names stay List/Calendar.
- Inline makeup scheduling removes the credit-date subtitle (holder view may retain the student name), uses the same right-side empty/selected card and full-width CTA as moving lessons, and places Same teacher in the week toolbar. Uncheck it to expose Many teachers slots and equal-width per-slot teacher menus. The parent credit picker remains available to distinguish makeup credits.
- Back-to-schedule controls retain an accessible label but display only the chevron.
- Final move/makeup booking, payment, family/card removal, lesson/makeup cancellation and recurring-change confirmations reuse the existing shared LoadingButton through ConfirmActionButton. The preview paints a busy state before the synchronous local mutation and guards duplicate clicks; it does not simulate a network charge. Opening a confirmation stays a normal button.
- Teacher menu Escape handling consumes the first Escape before dialog-stack dismissal, preserving the calendar panel.
- Verification: V3 full workflow at 1440/1366/1100/900/390 (including dependent-only editing, makeup multiple teachers, metadata style parity and payment busy/duplicate-click protection); V3 family at 1440/390; parent self-service V1/V2/V3 at 1440/390; parent family at 1440/390; V1 subscription continuity at 1440/1366/900/390; 273 academy tests and 17 makeup tests; TypeScript, targeted ESLint and diff whitespace checks.

### Press-and-hold confirmation

- Correction: consequential final actions now require a continuous **1.5-second hold**, rather than showing a loader after an ordinary click. The existing LoadingButton renders the fill; labels stay action-only and unchanged throughout the gesture (no Hold cue or progress text).
- Release early, drag outside, pointer cancellation, focus loss, Escape, or hiding the tab cancels progress. A quick click/tap never commits. Space and Enter support the same hold interaction. Completion performs the action once, then uses the shared busy state while an asynchronous operation finishes. Current preview mutations are local, not network charges.
- Applies to all ConfirmActionButton consumers: Book makeup, Move lesson, final payment, lesson/makeup cancellation, subscription cancellation/recurring confirmation, and family/saved-card removal. Navigating into a confirmation remains an ordinary click.
- Regressions exercise short click, early pointer release, touch tap, early keyboard release and complete keyboard/mouse holds. Hold screenshots: `/tmp/odeon-hold-confirm-{1440,390}.png`.

### Action labels and makeup identity

- Invoice entry actions read Pay $200 with a right-arrow icon (unnecessary .00 omitted; nonzero cents preserved). They open payment details without charging. The final payment action and payment dialog are labeled Pay.
- Confirmation controls retain their action text during the 1.5-second gesture; progress is visual fill only. Keyboard instructions remain available to screen readers, not on button faces or tooltips.
- The calendar action reads Reschedule lesson. Makeup headers contain only the program/duration title; the student name is inside the right-side Makeup summary card, visible before and after selection.

### Invoice history and full refunds

- Staff and parent billing share All invoices / Unpaid / Past invoices filters. Default All preserves current visibility; Past includes Paid and Refunded invoices. Invoice detail and PDF download remain available. Parent history retains payer/student scoping rather than exposing other payers’ invoices.
- Staff may open a paid invoice, choose Refund, enter a required reason and complete the final 1.5-second Refund gesture. This is a full-invoice, local-preview refund only; no processor or bank is called. Cancelling, tapping or releasing early never refunds. Partial refunds are not modeled.
- Refunded invoices retain original lines, payer and recorded payment details, plus refund amount/date/reason. They remain settled (zero amount due), cannot be paid again, and cannot be refunded twice. Exports include refund details. Parent actions reject refunds; parents can view their own refunded history but never issue refunds.
- Parent final Pay, Reschedule lesson, Book makeup, lesson/makeup cancellation and saved-card/family removal actions use the same shared hold interaction with unchanged action labels and keyboard support. Opening screens, editing drafts and ordinary navigation remain click actions.
- Regression: `scripts/security/invoice-history-refund-browser.cjs`; screenshots `/tmp/odeon-invoice-history-{1440,390}.png` and `/tmp/odeon-parent-invoice-history-{1440,390}.png`.

### Flexible advance invoices and billing schedules

- Billing actions → Issue invoice assembles subscriptions across the account, with student attribution on every line.
- Start + duration replaces the twelve-month checklist. Custom dates, nonconsecutive periods and subscription-specific overrides remain available.
- Live itemization and a sticky recipient/total strip update from subscription records. Billing metadata and partial-period policy are secondary controls.
- Existing issued coverage is excluded regardless of payment status. No unpaid invoice is silently replaced. Review reserves quoted dates temporarily in local state; issuance rechecks the reviewed snapshot and retry key.
- Optional recurring arrangements separate coverage duration from generation cadence and timing. Custom invoice prefixes, schedule overrides, future edits and pause/cancel are simulated; no background generation runs.
- See `docs/odeon-flexible-billing.md` for domain boundaries, pricing limitations, ledger/migration design, staging gates and test coverage.
- Regression: `scripts/security/flexible-billing-browser.cjs` at 1440/390px, with screenshots `/tmp/odeon-flexible-{builder,review}-{1440,390}.png`.


### Create invoice: current unpaid versus paid months
The simple composer can replace an unpaid current-month invoice when billing more months upfront. On November 10, an unpaid November invoice becomes November–January for a three-month request; paid November instead starts December–February. Replacement stays internal to the transaction, preserves original charges and unselected shared-invoice lines, transfers partial-payment credit, and marks sources Replaced only on confirmation. Full already-billed months are not prorated based on today's date. One-time advances preserve monthly cadence. Automatic future invoicing remains local configuration/simulation only. See `docs/odeon-flexible-billing.md` for source revalidation, payment-allocation and production-transaction requirements.

Invoice presentation: Create invoice bills full calendar months without automatic start-date proration. Review renders the shared branded invoice document. Replaced source invoices remain in the ledger but are excluded from every invoice-list filter. Lists show newest issue dates first and newly created invoices first for equal dates.
