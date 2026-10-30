# M0 walkthrough — Recurring private lessons

**Date:** October 26, 2026\
**Decision:** Owner selected recurring private lessons, full student journey, as the first shadow slice.\
**Status:** Scope selected; actual policies, source coverage, storage design and hosted safety remain unverified. No application functionality is implemented by this brief.\
**Parent brief:** `/Users/brunowong/pulse/docs/odeon-m0-shadow-academy.md`

**Subsequent owner decisions:** `/Users/brunowong/pulse/docs/odeon-enrollment-decisions.md` records automatic teacher-benefit conditions, best-offer-only pricing, versioned update/grandfather policy and card-before-review/charge-after-approval booking requests. These decisions supersede conflicting earlier proposals below, without claiming live implementation.

## 1. Purpose and boundary

Prove that staff can manage a student's recurring private lessons in Odeon from inquiry through enrollment, recurring sessions, daily changes, attendance and billing estimates. Opus remains authoritative for actual subscriptions, sessions and collections until a separately approved switch. Existing Odeon lead, messaging and access workflows keep their current ownership.

The initial implementation uses synthetic people and scenarios. No real sends, collections, external calendar changes or Opus writes. A real-data shadow beta is later and separately gated. Selecting this service does not select a real cohort or authorize access to customer records.

## 2. First experience to validate

Proposed staff entry points, not a committed UI design:

- **Student overview:** identity, authorized contacts, each enrollment, next lessons, relevant history, simulation context.
- **Enrollment workspace:** service, instructor, duration, operating dates, weekly slot, effective terms, clear pending information.
- **Day/week schedule:** actual occurrences, room/teacher/student conflicts, selected-occurrence versus future-series changes.
- **Change review:** before/after, effective date, affected sessions, policy consequences and simulated financial impact.

Staff should not need to navigate a relationship graph or understand agent tooling. The familiar People & access concept remains available for reviewing adults and student-specific grants; parent self-service is not required for this slice.

## 3. Walkthrough and evidence checklist

For each step, record **what Headliner does now**, who decides, which system is authoritative, exceptions, required data and the preferred Odeon experience. Do not treat proposed defaults as confirmed policy.

| Step | What the operator must confirm | Acceptance behavior |
|---|---|---|
| Inquiry | Adult learner vs guardian submission; multiple learners; trial path; what makes an inquiry won | Preserve inquiry; review/link identities; no automatic merge by shared email or surname |
| Trial | Whether required; how booked/priced; what happens after completion | Trial outcome distinct from recurring enrollment; no invented completion state |
| Enroll | Service/duration options, instructor assignment, start date, recurring slot, agreement/pricing requirements | Explicit enrollment ID and effective dates; one student can take two services independently |
| Schedule | Availability source, rooms, timezone, holidays, breaks, recurrence horizon | Concrete occurrences; no concurrent booking bypass; clear this-session/future scope |
| Teach | Who records attendance, status vocabulary, corrections, teacher notes | Stable session identity; two same-day sessions remain separate; actor/history retained |
| Change | Notice periods; student vs teacher cancellation; reschedule/substitute handling | Explain impact, preserve original record and policy version; no implicit live change |
| Make up | Who earns credit, unit/duration, expiry, redemption restrictions and exceptions | Ledgered entitlement and redemption; no duplicate credit; unresolved policy blocks a final entitlement decision |
| Estimate bill | Monthly basis, start-month treatment, holidays/fifth lessons, discounts, effective changes, credits | Versioned simulated estimate with assumptions; no charge; no false final total when required policy is unknown |
| Pause/leave/return | Notice, final lesson/charge, held slots, makeup balance, re-enrollment | Enrollment history preserved; changing one service does not stop another |
| Approve real change | Who may approve, apply in Opus and verify | Separate handoff with source IDs and reconciliation; no scenario auto-promotion |

## 4. Minimal scenario set

Use a small synthetic academy, not a production clone:

1. A guardian inquires for two siblings; only one confirms private lessons.
2. A student takes private lessons in two instruments, including two sessions on one date.
3. One child has adults in two households; a pickup-only contact has no billing access.
4. An instructor also enrolls as a student, using the same person identity.
5. A teacher absence requires a substitute for one occurrence only.
6. A family cancellation and a school cancellation produce separately configured policy outcomes.
7. A makeup is issued, booked, redeemed and corrected without duplicate value.
8. A student changes duration mid-cycle; calculate a provisional estimate under an explicitly selected test policy, then recalculate after an assumption changes.
9. A corrected baseline conflicts with a scenario; display conflict without overwriting the scenario or claiming the proposal is live.
10. Approve a simulated proposal for a mock live handoff, then introduce source drift; require reapproval and verified application before completion.

Private-pay, one responsible account is a proposed initial calculation case, **not an owner-approved exclusion of multi-payer or funded students**. Relationship and responsibility modeling must preserve those cases. Confirm the first financial acceptance scope before implementation.

## 5. Source-data inventory needed (headers/schema first)

Inspect exported field definitions and anonymized examples before requesting real records. Keep raw exports and credentials outside Git; never request raw card data.

| Entity | Evidence needed |
|---|---|
| People/student | Stable client/student IDs, role of submitter vs learner, external account links; shared/empty contact fields |
| Adults/accounts | Stable IDs, student relationships, additional contacts; distinguish contact designation from legal/operational access and responsibility |
| Subscription/enrollment | Stable subscription ID, student/service IDs, status, dates, duration, instructor, priced terms and change history |
| Schedule/session | Stable series/session IDs, start/end/timezone, room/location, teacher, cancellation/reschedule/substitution links |
| Attendance | Student + session reference, status and corrections; completeness/coverage and excluded rows |
| Makeups/credits | Source credit IDs or traceable provenance, quantity/unit, origin, expiry, redemption and opening balances |
| Billing context | Pricing basis, billing period, discounts, invoices/lines, balances, prepaid value and credits; no payment secrets |

If a required ID or relationship cannot be exported, identify a supported source or reviewed reconciliation strategy. Do not invent an exact match from a name/date combination. The existing CSV parser's client external ID and date-only attendance are not a complete migration contract.

## 6. Model decisions to settle before M1 migrations

- Existing canonical people/student/instructor/account IDs and actual hosted constraints.
- Direct adult–student relationship scope versus household grouping and payer responsibility.
- Service template, capacity-one offering, enrollment and effective commercial terms.
- Schedule rule versus occurrence and historical roster; timezone and source-ID mappings.
- Baseline version versus scenario change storage; application and database enforcement of context.
- Attendance/cancellation/makeup policy model; financial estimate assumptions and versioning.
- Explicit enrollment selection in Contacts and imports; compatibility for existing messaging/funding readers.

Do not add a global exclusive person type, a second staff identity, or an assumption of one enrollment/account/household per student. Financial ledger implementation can follow later, but its responsibility and history boundaries must inform the model now.

## 7. Next decisions, in order

1. Complete the partial billability policy in §9: exact notice cutoff boundary, exceptions, makeup expiry/redemption, and effective-date changes. Timely parent cancellations create makeups in the bin.
2. Walk through trial → enrollment and introductory-offer scope (§10). First-month tuition counts remaining teachable lesson dates and is collected on enrollment; ongoing tuition is collected on the first of each month for that month's lessons (confirmed).
3. Confirm source export structure/coverage and a feasible refresh approach for the selected scope.
4. Approve hosted schema and safety inventory; do not seed/refresh a hosted environment merely to inspect it.
5. Review the focused M1 model and acceptance fixtures before migrations or UI implementation.

**Completion test:** a staff member can explain one student's complete recurring private-lesson journey, and each required record, policy and authoritative source is accounted for. Open policy questions remain visible rather than encoded as assumptions.

## 8. Confirmed commercial direction — October 26, 2026

**Owner-confirmed Headliner policy:** recurring private-lesson tuition is the per-lesson rate multiplied by the billable lessons in that month. It is not a fixed monthly amount independent of the number of lesson dates. See §9 for confirmed closure/cancellation rules and remaining questions; rate-change handling remains open.

**Owner-confirmed mid-month start:** charge only for the remaining teachable lesson dates from the student's start in that month, at the applicable per-lesson rate. Exclude configured closures and dates before the start; do not prorate by calendar days or charge for earlier lessons. Introductory pricing depends on the offer; see §10.

**Owner-confirmed collection schedule:** collect initial-month tuition on enrollment, then collect on the first of each month for that month's lessons. This is the normal collection schedule, not proof of successful payment; payment method, failed-payment retries, outstanding-balance handling and future-dated enrollment treatment remain to be reviewed. Shadow scenarios simulate this schedule without initiating live collections.

**Owner-required platform flexibility:** support these plan shapes, using the Opus options supplied in the conversation as requirements context, not independently verified integration behavior:

| Plan shape | Visit entitlement / schedule | Payment arrangement |
|---|---|---|
| Single visit | One visit | One flat charge |
| Multiple-visit pack | A defined quantity of visits; not inherently a recurring slot | One flat purchase amount |
| Recurring membership with recurring payments | Recurring visits | Recurring billing; Headliner's first case is monthly billing from eligible occurrences × applicable rate |
| Recurring membership with one-time payment | Recurring visits for a bounded term or quantity | One payment, either a flat amount or an amount calculated from the covered visit count |

### Design consequences (proposed, not implemented)

- Keep **service**, **visit entitlement**, **schedule recurrence**, **pricing calculation** and **billing/payment cadence** distinct. Weekly visits do not imply weekly payments; recurring visits do not imply recurring charges.
- Plan templates provide configurable defaults. An enrollment references agreed, effective-dated terms; later template edits must not silently reprice past or existing commitments.
- Headliner's monthly estimate derives from identifiable occurrences and confirmed billability policy, not simply four times the lesson rate. Preserve rate, quantity, exclusions, adjustments and policy version so staff can explain the total.
- Rate changes, cancellations, holidays, reschedules, makeups and credits need explicit rules. An entitlement credit and a financial credit are not interchangeable.
- Visit packs and prepaid terms eventually need purchased/consumed/remaining entitlement and allocation to delivered visits; a payment or attendance mark alone is not an entitlement ledger.
- Model pricing and obligation separately from settlement. A one-time amount may be unpaid, partially paid or refunded; monthly billing is not proof of successful collection.
- Implement the first tested recurring/monthly/per-lesson path without hard-coding it as the only possible plan. Define the other shapes as design requirements, not completed features or mandatory first-release UI.

## 9. Closure, cancellation and makeup policy — owner walkthrough

Confirmed from the owner's description; these are requirements, not implemented behavior:

| Event | Current Headliner rule | Required shadow behavior |
|---|---|---|
| School closed on a date configured in settings | No classes and no charges for that date | Exclude the affected recurring occurrence from the teachable/billable count; show the closure reason |
| Parent cancels with sufficient notice | The lesson goes into the makeup bin | Create one makeup entitlement linked to the canceled occurrence; keep the notice timestamp and eligibility decision. Exact 24-hour boundary remains to be confirmed |
| Parent cancels with under 24 hours' notice | Not salvageable by the parent under the normal rule; staff sometimes exercise leniency | No automatic parent makeup entitlement; preserve the charge under the normal rule. Represent leniency as an explicit staff exception, with its actual remedy recorded rather than assumed |
| Teacher unavailable; substitute found | Try to find a substitute first | Preserve the occurrence and record the substitute without changing the recurring teacher assignment |
| Teacher unavailable; no substitute found | Call the parents; put a makeup lesson in the bin | Record notification work and the owed makeup linked to the original occurrence. In shadow, notification is simulated; no calls/messages are sent |
| Following month's tuition | Charged in full from that month's teachable lesson dates, e.g. its Thursdays, notwithstanding the owed teacher-cancellation makeup | Do not automatically subtract an outstanding makeup from the next month's regular lesson count or tuition |
| Makeup expiration | Headliner's makeups expire six months from when the makeup is issued, not from the original missed lesson date; the platform must also allow makeups that do not expire | Record issuance separately from the original lesson date. Configurable expiry policy, including no expiry; do not hard-code six months globally. Exact boundary semantics remain to be confirmed |
| Makeup redemption deadline | The makeup lesson must take place before expiry; booking before expiry alone is not sufficient | Check the proposed lesson date against expiry when booking and rescheduling; an advance booking does not extend the entitlement |
| Makeup instructor/instrument/format | Another instructor can teach the makeup. Sometimes makeups can be grouped, including with a different instructor/instrument | Preserve the original lesson context separately from actual delivery. Allow an explicitly arranged grouped or cross-instrument makeup; do not assume unrestricted parent self-booking |
| Makeup redemption quantity | One makeup session redeems one owed lesson (1:1), including an arranged grouped or different-instrument makeup; no duration/value conversion | Redeem one entitlement per participating student, not all entitlements for everyone in the group. This quantity rule does not require private-only delivery |
| Canceled makeup booking | Same cancellation rules as ordinary lessons: sufficient notice returns the makeup to the bin with its original expiry unchanged; under 24 hours normally forfeits it, subject to staff leniency | Retain the same entitlement, issuance, expiry and booking/cancellation history. Record return or forfeiture explicitly; do not issue a second makeup, restart the clock, or create an additional charge merely because the makeup was canceled. Any leniency is an explicit staff exception |

### Modeling and experience implications (proposed)

- A calendar closure is different from a canceled lesson that creates a delivery obligation. Do not derive every invoice adjustment solely from attendance/cancellation status.
- Show regular monthly lesson count, excluded closure dates, and outstanding makeups separately. A makeup owed is not automatically a monetary credit.
- Link a makeup entitlement to its original lesson and any redemption; retries/corrections must not issue duplicate entitlement. Confirm pricing treatment of redemption before calculating its financial effect.
- Support a staff exception with actor, reason and actual remedy, without changing the default policy or giving parents an automatic late-cancellation recovery action. Exception permissions and remedy choices remain to be agreed.
- Preserve whether staff still need to contact the family; a recorded teacher cancellation does not prove that contact occurred.
- Preserve the expiry policy applied to each entitlement and show its resulting expiry date, or explicitly show no expiry. Policy edits must not silently rewrite existing entitlements; extension permissions and treatment of existing balances need review.
- Keep issuance time distinct from import time: importing an existing makeup must not restart its six-month clock. Missing source issuance evidence is a reconciliation issue, not permission to assume the import date or original lesson date.
- A private-lesson makeup need not be a private occurrence with the original instructor/instrument. Model actual session instructor, instrument/service and format independently from the originating enrollment, with per-student redemption links for a shared session. This is a compatibility requirement, not approval to expand the first slice into full group-program management.
- Grouped makeup attendance must resolve each student's entitlement independently; one student's absence cannot mark every participant's makeup redeemed. Redemption is 1:1 per student, without duration/value conversion. Approval and capacity rules remain to be agreed.
- Returning a canceled booking to the bin is not a new issuance. Owner confirmed that the original expiry date is preserved; cancellation/rebooking does not restart the six-month clock. Any extension requires a separate policy/authorization decision. If already expired, retain the record/history without silently making it bookable again.

### Synthetic acceptance examples (not executed tests)

1. A month has five recurring Thursdays, one configured school closure, and a uniform lesson rate R: ordinary tuition estimate is 4 × R, before any other agreed adjustments.
2. A parent cancels 12 hours before a lesson: no automatic makeup; any leniency is a separate, visible staff decision.
3. A substitute covers one lesson: the recurring teacher remains unchanged.
4. No substitute is available: one makeup enters the bin, linked to the canceled occurrence, and parent contact remains pending until recorded.
5. The next month has four teachable Thursdays: ordinary tuition remains 4 × R even if the previous month's teacher-cancellation makeup is still owed.
6. A parent cancels 48 hours before a lesson: one makeup enters the bin, linked to the original occurrence; repeating the same cancellation must not create another entitlement.
7. Under Headliner's six-month policy, calculate expiry from issuance, not the missed lesson date; exact boundary rules remain to be agreed. Reimporting the same entitlement preserves its original issuance and expiry. Under a no-expiry test policy, show no expiry instead; do not invent a distant placeholder date.
8. A family books before expiry but selects a lesson after expiry: do not allow normal redemption of that entitlement. Moving an eligible booking to after expiry must also fail the normal eligibility check; any staff extension is a separately authorized exception, not an automatic effect of booking.
9. Arrange a makeup with another instructor: retain the original enrollment's teacher and instrument while recording who actually teaches the makeup.
10. Arrange a grouped makeup using a different instructor/instrument: link each student's original entitlement to the shared occurrence, preserve individual attendance/redemption history, and keep expiry eligibility per entitlement. Each student's completed makeup redeems one owed lesson, without duration/value conversion; one group attendance mark must not redeem all credits.
11. Cancel a makeup booking eligible for return: return the same entitlement to the bin, preserving the canceled booking history, original issuance and original expiry, and preventing duplicate issuance. Rebooking does not restart the six-month clock; do not silently reactivate an expired entitlement.
12. Cancel a booked makeup 12 hours before its lesson: forfeit the existing entitlement under the normal rule rather than returning it as available or issuing a replacement. Preserve history; any staff leniency is a separately recorded exception, not an automatic recovery or a new six-month issuance.
13. A student starts mid-month with three weekly lesson dates remaining, one a configured school closure: ordinary first-month tuition is 2 × R at a uniform lesson rate R. Earlier dates in the month are not charged; this is occurrence-based calculation, not calendar-day proration.
14. For that mid-month enrollment, simulate initial collection of 2 × R on enrollment. On the first of the next month, simulate collection for that new month's teachable lesson dates, excluding closures. Keep the initial and following-month obligations distinct, and do not mark either paid merely because its collection date arrived.

### Still open — do not encode defaults

- Timely parent cancellation creates a makeup; confirm any limits and financial treatment rather than inferring a refund or invoice deduction.
- Exact 24-hour cutoff, timezone and notice timestamp; permitted exceptions and who can authorize them.
- Six-month calendar-month/boundary semantics and timezone, including exact lesson start/end cutoff; any origin-specific exceptions, extensions and existing-balance treatment. The clock starts at issuance, and the lesson must take place before expiry (confirmed).
- Grouped/cross-instrument suitability and authorization, capacity, booking and redemption lifecycle. Another instructor is permitted; grouped/different-instrument delivery is sometimes permitted, with 1:1 redemption (confirmed), not unrestricted booking.
- Canceled makeups follow the ordinary cancellation rules (confirmed): sufficient notice returns the same entitlement with unchanged expiry; under 24 hours normally forfeits it, subject to staff leniency. Explicit no-show handling and any repeated timely-cancellation limits remain to be confirmed.
- Whether teacher-cancellation alternatives include refunds, and how a redeemed makeup avoids an unintended additional charge.
- Closure changes after billing, rate changes, payment method, failed-payment retries, outstanding balances and future-dated enrollment treatment. Initial-month tuition is collected on enrollment and ongoing tuition on the first for that month's lessons (confirmed); introductory offer options are confirmed in §10, while their precise scope and trial-to-enrollment treatment remain open.

**Next planning step:** focused M1 model/compatibility review using the confirmed workflow and configurable offer requirements. Individual promotion definitions are not prerequisites for that review; unresolved operational edge cases remain visible rather than becoming assumed defaults.

## 10. Saved offers, trials and configurable discounts

**Owner-confirmed:** Headliner can decide its own offers, using monetary values or percentage discounts. Free, $5 first class and a first-month percentage discount are examples, not an exhaustive list or fixed promotion catalog. Model configurable terms rather than requiring the owner to specify every possible offer during M0.

**Owner-confirmed saved offers:** an offer can be saved under a reusable name, such as “Summer Offer Special,” “Black Friday,” or “Owner's Discount,” and selected again rather than recreated for each customer. These are examples of names, not predefined promotion behavior. Offers are not restricted to trials or introductory periods; their configured scope determines where they apply.

### Proposed model boundaries (not implemented)

- Keep the underlying service/payment plan separate from the introductory offer. A first-class price and a first-month discount have different scopes; do not model all offers as one trial-session price.
- Separate the **saved offer definition** (tenant-scoped identity, name and configured terms) from each **offer application** (selected customer/booking/enrollment, applied version and accepted terms). Names are display labels, not keys or instructions to infer eligibility, dates or calculation rules.
- Proposed staff flow: create/name/configure/save an offer, then select it when reviewing applicable pricing and preview its effect before applying. Editing or archiving a saved offer must preserve historical applications; whether an offer recurs is explicit configuration, not implied by reuse or by a name such as “Owner's Discount.” Permissions and lifecycle details need review before implementation.
- Make monetary semantics explicit: a fixed promotional price (e.g. a $5 first class) is not the same as a fixed amount off. Proposed configuration distinguishes fixed price, fixed-amount discount and percentage discount, with zero-price offers supported. These are design shapes, not implemented functionality.
- Record the selected offer, eligibility, covered visit or billing period, calculation terms and version on the accepted enrollment/booking. Editing a promotion later must not silently change previously accepted terms.
- Distinguish offer selection, trial booking, attendance, conversion and recurring enrollment. A free or discounted booking does not prove attendance or authorize recurring collection.
- Preserve the ordinary tuition basis and show any offer adjustment separately. A zero-dollar trial is still a scheduled visit, not evidence of a successful payment transaction.
- Make eligible services/people, covered visits or periods, effective dates, usage limits and stacking explicit configuration, not global assumptions. The academy supplies these terms when defining an offer; no particular first-month promotion must be finalized to proceed with model planning. Trial-to-enrollment allocation and authorization still require workflow review before implementation.

### Synthetic acceptance examples (not executed tests)

1. Select a free-trial offer: show a $0 introductory visit while retaining its booking and attendance lifecycle; do not mark the student as recurring solely because the trial is booked.
2. Select a $5-first-class offer: show $5 for the covered first visit, not for every lesson or the full month. Do not double-count that same visit during conversion; the precise conversion allocation awaits policy confirmation.
3. Configure a synthetic 40%-off offer for an explicitly selected eligible billing period: show the ordinary tuition, a 40% reduction and the remaining 60% separately. This is a test configuration, not an assertion about a live Headliner promotion; do not silently carry it into later periods.
4. Configure a synthetic fixed-amount discount and a fixed promotional price with the same numerical value: calculate them as distinct operations and show the selected monetary meaning clearly. Validate configured scope and prevent accidental double-discounting.
5. Save a synthetic “Summer Offer Special,” select it for two eligible enrollments, and retain two distinct applications of the same saved definition. Neither enrollment should require recreating the offer.
6. Change the saved offer's terms or display name: existing accepted applications retain their applied terms/version and audit history. Archive the definition without erasing prior applications. A different tenant must not be able to select or edit it.

**Planning boundary:** offer flexibility is confirmed. Specific promotion values and scopes are configuration decisions, not additional M0 discovery questions unless they expose a missing model capability. No offer configuration or live pricing has been changed.