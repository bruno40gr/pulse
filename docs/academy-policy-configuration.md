# Academy policy configuration — planning draft

Status: approved survey direction, not implemented configuration or enforcement.
This document consolidates the planning conversation. It does not publish terms,
set production defaults, or change existing enrollment/payment structures.

## Interactive mockup now available

Policy editing now follows a settings-row layout: left-aligned labels,
right-aligned controls of consistent width, and subtle dividers within each
category. The same label-left/control-right layout now applies to labeled fields
throughout School Setup, including Plans & prices, services, teachers, rooms,
discounts and agreements. Rows use compact 10px vertical padding with no extra
field-grid row gaps; switches use 8px padding, while controls retain their 42px
minimum height. Lesson price labels and saved pricing summaries explicitly show
USD. Native switches remain on the right; fields stack
below labels on narrow panels. Policies, Calendar, School details, progression
levels and discount-combination policy open directly as editable settings. Save
changes appears only when values differ from the saved state; saving leaves
controls editable. Navigation confirms before discarding unsaved changes.
Validation, conditional fields and accessible labels remain in place. Browser
checks cover desktop/mobile alignment, keyboard switches, save and discard.

UI refinement: navigation now separates **Policies** (`section=policies`) from
**Calendar** (`section=calendar`). Policies uses grouped settings rows rather than
summary cards or per-card Edit actions. Expiry and freeze fees use single
accessible switches, with a separate unconfigured hint until chosen;
multi-outcome rules retain selects. Family self-service exposes cancellation,
rescheduling and makeup switches directly; missing legacy values retain the
previous enabled behaviour. These are in-memory settings, not enforced access
controls. The teacher-absence explanatory sentence has been removed.
Agreements retain their separate draft/preview/publish flow and version history;
individual entity editors remain unchanged.
Agreements uses shared empty states for creation and
acceptance history. Calendar reuses the original ClosureTable, preserving US
federal holiday presets, observed dates, location scope and custom closures.
Both views share the existing in-memory record, so saving calendar dates retains
policy/agreement values and saving policies retains calendar dates.

The setup host on port 3199 now renders the policy flow in **Policies**
(`section=policies`). Edit details opens cards for cancellation/attendance,
makeups, teacher absences, closure treatment and pauses/withdrawal. Saving
returns to a policy summary. Unselected decisions remain explicit; conditional
values are validated when enabled. This is draft configuration, not publication
of enforced policy. Legacy cancellation choices are retained, but old month-based
expiry is not silently converted to days.

Below the summary, **Agreements & acceptance** supports adding/editing drafts,
school-wide/special-offering scope, text preview, effective date, publication
audience and append-only in-session version snapshots (including scope). No
acceptance records, requests or notifications are generated. The room editor has
an optional HTTPS conference link; teacher Contact details has photo upload,
preview, replace and remove using the existing image validation conventions.

All of these changes save only in memory and reset on reload. Photo data is a
local image preview, not server storage. Teacher self-service access and admin
authorization are requirements, not implemented permissions in this host.
Actual special-agreement assignment precedence, binding agreement acceptance,
policy enforcement, real remedy approval workflows and payment consequences
remain future integration work. The planned closure options and freeze-fee
timing options are reviewable mockup choices, not newly approved school rules.

Validation: `scripts/academy/policy-setup.test.cjs`, existing setup/demo tests,
published-host TypeScript, targeted lint and
`previews/published-app/verify-policies.cjs`. Browser coverage checks policy
validation/save/cancel, draft/publication/version history, special offerings,
room link saving and photo upload/save/cancel at 1440px and 390px.

## 1. Product boundary

Design for any academy. Headliner is a worked example, never a hardcoded policy.
Keep these concepts distinct:

- **Policies:** structured choices that determine operational outcomes.
- **Agreements:** family-facing wording and evidence of the version accepted.
- **Operational settings:** rooms, links, profiles and business configuration.

Writing a rule in agreement text must not silently configure enforcement.
Publishing agreement wording must not silently change prices, bookings or the
terms stored against existing enrollments. Conversely, changing a structured
rule should flag related agreement wording for review.

Existing pricing/payment structures remain in Plans & prices. Do not repeat that
survey or require a single tuition structure for an entire academy.

## 2. Proposed settings structure

| Destination | Contents |
| --- | --- |
| Policies | Cancellations/no-shows, makeups, teacher absences, closures, pauses and withdrawal |
| Agreements & acceptance | School-wide agreement, special-offering agreements/waivers, drafts, versions, publication and acceptance history |
| Locations & rooms | Location details, operating hours, closure dates and room-based conference links |
| Teachers | Contact details/photo, assignments and schedule; existing schedule and time-off behaviour retained |

These are proposed destinations, not a final sidebar redesign. Keep School
details, Services & programs and Plans & prices; do not force every business
setting into Policies. Calendar actions can reference centralized policy without
duplicating policy configuration on every closure entry.

Use existing shared components and layout rules when implementation starts.
Preserve the approved published Contacts table, V3 workspace and enrollment flow.

## 3. Administrator workflow

1. Configure the main rule for each policy area.
2. Reveal follow-up fields only when the selected choice requires them.
3. Review a plain-language summary and unresolved decisions.
4. Review related agreement wording and who the change applies to.
5. Preview effects, choose an effective date and publish explicitly.

Keep onboarding breadth-first. Do not turn it into an incident-response survey.
Exact operational permissions and unusual exceptions belong in later/advanced
configuration. Never silently adopt Headliner's answers or seed values for a
new academy. Existing configured values may be prefilled, but remain reviewable.

## 4. Policy configuration map

“Supported choices” below describes product capability agreed in the survey.
It does not imply a particular selection for Headliner unless stated in section 5.

| Area / administrator question | Supported choices | Conditional follow-up / boundary |
| --- | --- | --- |
| What happens after an eligible student cancellation? | Reschedule, issue a makeup entitlement, or enable both options | Notice threshold remains configurable/unresolved. Prevent granting both benefits for the same cancellation. No credit/refund or omit-charge option in this flow for now. |
| What happens after a late cancellation? | Forfeit lesson; allow rescheduling/makeup; staff review | Separate from no-show settings. Reuse existing waive-penalty action for an exception; do not invent a second waiver mechanism. |
| What happens after a no-show? | Forfeit lesson; allow rescheduling/makeup; staff review | Configure independently from late cancellation. Exact staff-review flow remains open. |
| How long are makeups valid? | No expiry, or configurable number of days | Show day count only when expiry is enabled. Existing prototype's months field is not the final model. |
| How many makeups are allowed? | Configurable limit per period | Count and period remain open. Unlimited was not explicitly selected; do not add it as a confirmed requirement. |
| Who may teach a makeup? | Original teacher only, or any qualified teacher | Qualification and availability still apply. |
| What is the makeup format? | Same lesson format and duration as the missed lesson | Alternative/group makeup format was not selected for this scope. |
| Can families manage lessons? | Family self-service for cancellation, rescheduling and makeup booking | Enforce configured rules; retain staff actions. Staff-only/per-action switches were not selected for this scope. |
| What can resolve a teacher absence? | Substitute, reschedule, makeup; multiple options may be enabled | Do not add credit/refund to this flow as an approved requirement. Selection/notification workflow remains open. |
| What happens during a temporary enrollment pause? | Pause supported; optional freeze fee | Fee amount, charging basis and timing remain open. Do not reuse enrollment pricing as an implicit freeze fee. |
| Is the regular slot held during a pause? | Hold or release, configurable by academy | Separate decision from whether a freeze fee applies. Return/rebooking details remain open. |
| When can enrollment end? | Immediate; after required notice; end of billing period | Exact notice and final-bill treatment remain open. These are alternative supported configurations, not three simultaneous rules. |
| How are planned closures handled? | Academy explicitly chooses lesson/billing/makeup treatment | Headliner example is confirmed below. Other academy treatments are required in principle, but their final option set and pricing-model mappings are not yet approved. |
| How are unexpected closures handled? | Review affected lessons before applying a remedy | Headliner incident workflow is below; do not require every academy to adopt its approval hierarchy. General configuration choices remain open. |

Rescheduling moves the original lesson; a makeup entitlement permits a later
replacement booking after cancellation. Neither is an account monetary credit.
Any implemented lifecycle must prevent duplicate entitlements and benefits.

## 5. Headliner closure example — not global defaults

### Planned closure

- One school-wide policy across all offerings; no offering-specific exceptions.
- Known closure dates are excluded from chargeable lesson dates upfront.
- No makeup entitlement is issued for an uncharged closure date.
- A family can book an additional paid lesson separately.
- Do not implement this as charging first and automatically issuing a credit.

Other academies must explicitly choose their closure treatment. How exclusions
map to fixed-price/installment structures remains a design decision; do not
silently infer repricing or a new payment structure.

### Unexpected closure

- Staff prepare an incident and review affected lessons and payment status.
- One remedy applies to the entire incident; no individual lesson exceptions.
- An owner/admin approves the remedy before remedy notifications are released.
- Designated managers can immediately block new bookings; other staff request it.
- Managers can send an immediate closure notice using a preapproved template,
  while remedy details await approval.

These details were captured before the survey intentionally returned to a
breadth-first approach. Preserve them as Headliner examples, not mandatory
onboarding questions for every academy. The actual remedy remains a decision
for each incident. Never refund an unpaid lesson or create duplicate benefits.

## 6. Agreements & acceptance

Confirmed direction:

- One school-wide enrollment agreement for ordinary offerings.
- Separate agreements/waivers can be assigned to special offerings, such as
  summer camps, one-off events and birthday parties.
- Whether a special agreement supplements or replaces the school-wide one is
  unresolved; do not assume replacement.
- Support drafts, published versions, change summaries, effective dates and
  acceptance history. Keep previously accepted text/version intact.
- New enrollments accept the latest applicable published agreement.
- When publishing an update, support new-enrollment-only publication or an
  explicit request for existing families to accept it. Preserve existing
  accepted versions by default.
- Do not treat publication, notification and acceptance as the same event.

Planned acceptance evidence should identify who accepted, their relationship to
the student/enrollment, the document version and when acceptance occurred.
Exact acceptance mechanism, authority, reminders, refusal handling and access
restrictions remain open. This is product design, not a legal conclusion about
whether particular wording or acceptance is enforceable.

Screenshot inspiration worth retaining: version history, revision notes,
service/offer assignment and exportable acceptance records. Do not copy the
large icon-heavy forms or statistics-heavy policy listing. Screenshot examples
such as 90-day monetary-credit expiry/no refunds are not approved school rules.

## 7. Rooms and teacher photos

### Room conference links

- Conference links belong to rooms, not teacher profiles.
- Add an optional conference URL to the existing room editor and summary.
- Do not imply that creating a room automatically creates a Zoom meeting:
  the reference screenshot only demonstrates a URL field.
- Automated meeting creation/integration is not approved by this survey.
- Link visibility, delivery to booked participants and changes affecting
  existing bookings remain implementation decisions. Do not expose private
  lesson links in public room listings by default.

### Teacher profile photo

- Put upload/preview/replace/remove in the teacher Contact details card.
- Teachers may manage their own photo; admins may manage teacher photos too.
- Enforce ownership/admin permissions server-side when persistence is added.
- File rules, crop controls, storage and display surfaces remain to be designed
  using existing upload patterns. A local preview must not imply a saved upload.

## 8. Remaining broad gaps — not another detailed survey yet

- Exact notice cutoffs, makeup limit counts/periods, expiry start point and
  freeze-fee amounts/basis; any interaction between expiry and booking dates.
- Planned-closure treatment choices for other academies and their relationship
  to existing pricing structures; separate monetary credits from makeups.
- Final-bill/proration and pause/withdrawal effects on existing bookings.
- How enabled absence remedies are selected and whether families choose.
- Agreement composition for special events and rollout to existing families.
- Staff time-off approvals, paid-rest/meal policies and payroll boundaries:
  existing duration selectors do not implement the earlier take/waive discussion.
  Retrieve the original attachment before adopting its interpretation.
- Privacy/consent, communications and any additional business settings from the
  screenshots should be assessed separately, not silently added as requirements.

## 9. Implementation boundaries and acceptance checks

Current setup remains an in-memory interaction model. This planning document
does not add a policy engine, persistent agreements, file storage or conference
integration. Existing seed rules are not evidence of survey approval.

Before enforcement is wired:

- Establish authoritative structured policy data, versions, effective dates
  and references from enrollments; preserve historical snapshots.
- Resolve the effective policy consistently across enrollment, staff booking,
  family self-service, recurring lessons, makeups, reschedules and automation.
- Evaluate each occurrence date against effective weekly availability, time
  off, location closures, capacity and protected time—not only the base schedule.
- Recheck on commit, prevent duplicate credits/entitlements and concurrent
  bookings, and record staff exceptions through the existing waiver mechanism.
- Preview affected existing lessons/subscriptions before changes; never silently
  move or cancel them. Preview and confirm notification/remedy effects.
- Test each supported policy outcome, failed eligibility, waive-penalty behaviour,
  expiry/limits, payment-structure interactions and agreement version preservation.
- Validate room-link and photo save/cancel/reopen, permissions and privacy once
  those features are implemented. Repeat desktop/mobile Contacts/V3/enrollment
  regressions; preserve existing shared calendar callers.

Next step: review this map for missing broad categories, then design the policy
summary/editor and agreements workflow using shared UI. Do not reopen the full
payment-structure survey or branch into niche incident cases during initial setup.