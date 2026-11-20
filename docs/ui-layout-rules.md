# Shared UI layout rules

Control selection/focus colors and primitive ownership follow `docs/ui-interaction-colors.md`.

## Skeleton-first loading

- Every data-driven screen, drawer, tab and composer defaults to the shared
  `LoadingSkeleton` while its required initial data is pending. Keep stable
  framing where useful, but do not render a partially hydrated editor.
- Empty arrays and missing values during loading are not verified empty/setup
  states. Never flash “No records”, zero metrics, or “Set up organisation email”
  before the requests that establish that state have settled.
- Gate the ready surface on every required dependency (for email: recipients
  AND authorised senders). Show genuine empty/setup/error states only after
  loading finishes. Failed requests must not masquerade as an empty success.
- Route `loading.tsx` is a fallback, not a replacement for client-fetch loading
  states. Use the shared skeleton's accessible label and `aria-busy` semantics.
- Regression tests must delay requests independently and verify no empty/setup
  content flashes, then check success, confirmed empty, and failure transitions.

## Flat surfaces

- Use `spacing.lg` for peer-card gutters in the lead detail surface: summary cards, vertical card stacks, column separation and the content inset below the toolbar. Align Notes and summary-card top edges; do not add a Notes-only inset or extra column-side padding. Internal field spacing is independent of card gutters.

- Use `DenseSectionPanel` for titled groups with header actions. It defaults to flat, an 8px radius, 18px padding and no shadow. Use its `actions` slot for card-level actions.
- Use `SurfacePanel appearance="flat" tone="muted"` for quiet contact/lesson summaries. Muted flat surfaces have no border or shadow.
- `SurfacePanel` retains its raised default for existing unrelated screens; use `appearance="raised"` explicitly when elevation is meaningful. Do not add shadow overrides to profile cards.
- Lead and contact detail cards use the shared default border (`colors.border`); do not override contact cards with `colors.borderLight`. Keep the light token for structural dividers. Both communication rows use `SlidePanelActionBar`: white background, light bottom divider, matching responsive padding and wrapping. Preserve per-view routing, permission, account-holder fallback and disabled-state rules; unavailable actions may legitimately look different.
- Ordinary form sections use a heading and spacing, not another box. Box a repeatable entity (student, family member, lesson) or independently actionable content. Do not box a dropdown alone or nest cards for each field.
- Add-lead students are an explicit exception to entity boxing: keep the outer Students section, but render Student 1, Student 2, etc. as borderless fieldsets with legends and spacing. Do not put a box around each student.

## Fields and dropdowns

- Communication actions use shared `Button` variants: primary Call, secondary SMS/email, ghost copy. Enabled, disabled, and loading presentation belongs to the shared library, never per-panel inline styles or CSS. Data and routing determine availability only; the same action in the same state must look identical in lead and contact panels.

- Maximum **two editable controls per row**, including dropdowns. Three or more dropdowns are never a form row.
- Use `FieldGrid`: one column by default, two only when the grid's actual container is at least 540px wide. With an 18px gap this leaves at least 261px per control. This is container-based: a narrow rail on a desktop stays one column.
- Pair only short, related fields (first/last name, email/phone, date/interval). Long options, multi-selects, conditional controls, descriptions and address/search fields get a full-width row (`FieldGrid columns={1}` or a separate grid). Do not pair unrelated controls merely to fill a gap.
- A repeatable person's header contains their name/number and removal action. Controls go below, not in the header beside trash. Do not squeeze name, age, program and trash into one row.
- Shared `Input`/`Select` have 42px minimum height. `Select` reserves space for a decorative caret inset 12px from the right, retaining native interaction and native arrows in forced colors. Compact table/status controls may explicitly opt into smaller dimensions; normal form fields may not.
- Associate every editable label with its control. Shared controls generate an ID if needed and link helper/error text. Keep keyboard focus visible. Read-only `FieldLabel`/`DetailField` are not editable form labels.
- Required fields start neutral. In Add lead, use neutral gray helper text while filling out the form; reserve red errors and invalid semantics for an attempted save. Focusing or leaving fields must not trigger missing-value warnings. Clear errors when corrected and reset submitted state for a fresh form. Required indicators and neutral hints are allowed before interaction. Keep submission available to explain missing values, guard requests with validation, and disable only while saving. Add lead requires a contact name and a valid email address. Phone does not substitute for email; phone remains optional.

## Heading hierarchy

- Inside-card titles use `SectionTitle variant="card"`: 18px (`sizeLg`), bold (`weightBold`), with header spacing owned by the card. `DenseSectionPanel` applies this automatically to string titles; custom title nodes must use the same variant. Apply consistently across enrollment, lead and contact surfaces, including Notes and Follow-up. Keep semantic h2/h3/h4 levels unchanged; do not globally restyle h3 or add per-screen size/weight overrides.

- Blocked Add-lead saves focus and scroll to the top error summary, retain inline field errors, and repeat the failure message beside the bottom save action. Require email and validate its basic format even when phone is supplied. Enforce this for manual intake on the server without changing public website phone-only capture. This is syntax checking, not address verification.

- **h1:** page title, once per page.
- **h2:** page's main sections, or a drawer/dialog title (`SlidePanelHeader`). A drawer does not get another h1 just because it overlays the page.
- **h3:** sections beneath that h2, e.g. Contact details, Request details, Follow-up, Student 1 in an enrollment step.
- **h4:** a nested entity beneath an h3, e.g. Family member 1 inside Family members. If a lower heading is needed, use it rather than skipping levels to obtain a smaller font.
- `SectionTitle as="h3"` chooses semantics explicitly. `DenseSectionPanel` string titles default to h3 and accept `headingLevel`. Custom title nodes must select their own heading level. Visual scale is separate from hierarchy.
- A label, field value, metric, name chip or action is not a heading just because it is bold.
- Add lead is a form surface with peer **h2** sections: Contact details, Students, and Attribution (or Request details for service inquiries). Do not mechanically demote all drawer sections to h3 because the drawer title is h2. The form's information architecture determines these peer sections; student fieldsets remain subordinate. Attribution uses the shared Disclosure and defaults closed.
- Add lead's surface title is **h1**, configured through `SlidePanelHeader headingLevel="h1"`; existing detail panels retain h2 by default. Header sizing belongs to the shared header: 64px minimum on desktop and 56px on mobile, with 8px/4px vertical padding. Preserve close-control hit targets and let long titles/subtitles grow naturally.

## Adoption and scope

Applied to enrollment student/review surfaces and responsive field grids; lead detail/family editors; contact profile/edit cards; and add/edit-lead section grouping. Existing scheduling/lesson-specific controls retain domain behavior and their selected-state styling. Notes retain bounded scrolling, and communication controls remain in their surface header.

These are presentation changes, not identity, consent, booking, payment or messaging-contract changes. Shared form accessibility and caret improvements intentionally apply to other consumers of those primitives. Browser review at narrow and wide panel widths is required before calling the visual pass complete.

## Add-lead information architecture

Do not replace the Students section with a family-count stepper or a single generic request form. Lesson/tour inquiries use a Students section with an Add student header action and numbered student fieldsets. Contact details owns contact name and birthday. When Classes are for myself is checked, hide the student name and birthday controls and use the current contact values; do not show read-only duplicates. Unchecking reveals the separate student's name/birthday and preserves previously entered draft values. Lesson-interest controls (service, program, experience, available days and preferred times) remain visible in both states. Service and program belong to each student, not to the contact. The screenshot's grouping is preserved while field rows still cap at two. Concrete cards determine the interested-student count.

Component/style migrations must preserve conditional visibility, default state, draft retention and submitted values. Record those behaviors in regression tests before replacing form structure. A rendering test alone is not evidence of behavioral parity. Do not invent missing historical conditions when they cannot be recovered; identify that gap explicitly.

Student details are saved as inquiry payload (`student_requests`), not canonical identities or enrollment. First-student summary fields and existing family/sibling projections remain populated for current lead readers. The current legacy edit/detail forms do not yet provide a complete per-student birthday/service editor; do not claim that migration is complete.
## Page and enrollment layout ownership

- Use the shared `PageContainer` and `PageHeader` for dashboard page geometry; do not reproduce their inset or heading spacing in individual pages. A nested `PageContainer` inherits its parent's inset (it does not add padding). The Beta export delegates to the same component.
- Use `EnrollmentLayout` for lesson/trial, band enrollment and workflow editors. It owns a horizontally centered, top-aligned task column inside the existing page inset: 800px focused by default, 1100px expanded for scheduling. Editors select the width mode, not local max-widths or extra page padding. Dashboard workspaces remain full-width and left-aligned.
- Wizard headers use shared `PageHeader` compact density; title/actions, stepper and content share the task column. Preserve normal field/button sizing while reducing framing and whitespace. On mobile, show the compact step summary, progress bar and accessible numbered navigation instead of squeezing desktop labels. Workflow summaries stack below the form instead of consuming a sidebar in the focused column.
- Step transitions retain heading focus and existing validation/draft behavior. Scheduling may expand the column; do not animate or vertically center the task. Repeated wide/narrow workflows should use a stable expanded frame rather than repeated resizing.
- Enrollment titles have no back chevron. Keep explicit Close / Save & close and step-level Back / Continue controls. Calendar stays inside `DashboardShell`, rather than using a viewport-fixed root.
- Main enrollment contact selection uses the shared vertical radio group: Existing contact (default, collapsed search dropdown below) / New contact (detail fields below). Student cards do not repeat the radio group; they use detail fields with an optional Find existing student action. Search results open only on click, typing or arrow keys, and close on Escape, the close button, outside click or selection. Preserve entered values between modes. The contact step starts with Add a contact, followed by the vertical choices without a visible group legend. Separate search/details with spacing tokens; use the shared label role for Search for a contact and subordinate heading role for Contact details. Classes are for this person uses the shared inline Switch beside its text, only after an existing contact is selected or manual name/contact details are valid; student cards and Add another student appear only when off. Existing family/account selections retain their inferred students. Toggling back to separate students restores their draft details. Do not apply generic field-label layout rules to checkbox/radio/switch labels.
