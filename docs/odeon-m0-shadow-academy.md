# M0 — Operational ownership and shadow-academy blueprint

**Date:** October 26, 2026\
**Status:** Direction agreed; implementation proposal and readiness gates remain open.\
**Scope:** Headliner operational replacement, not actionable Highlights or agent infrastructure.\
**Companion assessment:** `/Users/brunowong/pulse/docs/odeon-m0-readiness.md`\
**Reading copy:** `/Users/brunowong/pulse/docs/odeon-roadmap-2026-10-26.pdf`

**M1 planning:** `/Users/brunowong/pulse/docs/odeon-m1-domain-compatibility.md` and `/Users/brunowong/pulse/docs/odeon-m1-acceptance-plan.md`. Owner requested progression to M1 design; M0 sign-off and implementation safety gates remain open.

## 1. Decision record

Agreed direction:

- Odeon should eventually own Headliner's operational records and business state, not remain a spreadsheet-fed reporting layer.
- Opus and Odeon will coexist during development. Parallel use must not create competing live authorities.
- A shadow academy will rehearse day-to-day work, eventually using an approved copy of real operational data, without collecting real money.
- A shadow decision is not a live instruction. Selected real changes may later use a separate approved handoff to Opus.
- Payment activation is a controlled cutover gate, not the first billing test.
- Trust, correctness, and a delightful staff experience precede actionable Highlights and agent execution.
- AI-ready domain operations are desirable; an MCP server, agent runtime, automated Opus bridge, and autonomous outreach are not M0 prerequisites.
- Owner selected **recurring private lessons, full student journey**, as the first shadow slice. See `/Users/brunowong/pulse/docs/odeon-m0-private-lessons.md`. A real cohort, policy details and financial scope are still to be confirmed.
- Owner confirmed Headliner's recurring private-lesson tuition is **per-lesson rate × billable lessons in the month**. Odeon must also support single visits, visit packs, recurring-payment memberships and one-time-paid recurring terms. Scheduling, entitlement, pricing and payment cadence must remain distinct.
- Mid-month starters are charged only for **remaining teachable lesson dates from their start**, excluding configured closures and earlier dates. This is occurrence-based calculation, not calendar-day proration. **Collect initial-month tuition on enrollment, then on the first of each month for that month's lessons** (owner-confirmed). Collection schedule is not proof of successful payment; payment-failure handling remains open. Shadow collections remain simulated.
- Offers are **academy-configurable using monetary values or percentage discounts**. Free, $5 first class and first-month percentage offers are examples, not a fixed catalog. Keep fixed promotional prices distinct from amount-off discounts, and visit-level scope distinct from period-level scope and the underlying payment plan. Individual promotion terms are configuration decisions, not prerequisites for M0 model review; trial-to-enrollment treatment still needs workflow review. See the private-lesson brief §10.
- Offers can be **saved, named and reused**, e.g. “Summer Offer Special,” “Black Friday,” or “Owner's Discount.” Separate the tenant-scoped saved definition from each versioned application; later edits must not silently change accepted terms. Names do not imply dates, eligibility or recurrence, and offers are not limited to trials.
- Configured school closures mean no lesson/no charge. Parent cancellations with sufficient notice go into the makeup bin; under-24-hour cancellations normally cannot be recovered by the parent, with occasional staff leniency. For teacher cancellations, seek a substitute; otherwise contact parents and put the owed makeup in the bin. The next month's regular tuition still counts its full teachable dates, without automatically deducting owed makeups. See the private-lesson brief §9 for details and unresolved policies, including the exact notice cutoff boundary and makeup expiry.

- Owner confirmed **six-month makeup expiry from issuance for Headliner**, not from the original missed lesson date. **The makeup lesson must take place before expiry; booking before expiry alone is insufficient.** Expiration must be configurable, including no expiry; the exact date/time boundary and any origin-specific exceptions still need confirmation. Importing an existing entitlement must not restart its clock.
- Makeups can be taught by another instructor and can sometimes be grouped, including with a different instructor/instrument. Redemption is **1:1: one makeup session redeems one owed lesson per student**, without duration/value conversion. Preserve original entitlement provenance and actual delivery separately, with per-student redemption for shared sessions. Authorization remains open; this is not blanket permission for unrestricted cross-instrument/group booking.
- A canceled makeup booking follows the **same cancellation rules as ordinary lessons**: sufficient notice returns it to the bin **with its original expiry unchanged**; under 24 hours normally forfeits it, subject to staff leniency (owner-confirmed). Preserve the same entitlement, issuance and booking history rather than issuing a duplicate or restarting the six-month clock. The exact cutoff boundary and exception permissions remain open.

This document supersedes the earlier suggestion to make persistent Highlights the next delivery milestone. It does not replace account policies or the external-school/commercial gates in `/Users/brunowong/pulse/docs/foundation-roadmap.md`.

## 2. Three separate operating contexts

### Verified baseline (live mirror)

A versioned, reconciled snapshot of actual operations from the authoritative source. It is not necessarily current. Show source coverage and extraction time, separately from import time. Keep source IDs, reconciliation results, and unresolved exceptions. Preserve prior baselines when scenarios depend on them.

### Shadow scenario

A branch of a particular baseline containing hypothetical enrollments, sessions, attendance, makeups, and financial estimates. It cannot send customer communications, write external calendars, collect money, or modify Opus. Every estimate and document is visibly simulated. Resetting a scenario must not erase the baseline, another scenario, or approved handoffs.

### Approved live change request

An explicit, reviewed request to change actual operations. During initial coexistence, staff apply it in the authoritative system and verify the result. There is no automatic promotion of shadow edits. This is a later capability requiring a separate acceptance gate, not enabled by this document.

**Deployment decision:** start synthetic acceptance in isolated staging. Before a real-data shadow beta, choose and verify an isolated shadow environment or an equivalently enforceable boundary. A badge, demo flag, or tenant label alone is not an integration safety boundary. No new deployment or storage model is prescribed without the environment review.

## 3. Domain ownership map

“Current” below is a repository-based assessment or the user's description; live configuration and full Opus usage are not independently certified.

| Domain | During coexistence | Shadow purpose | Target and switch gate |
|---|---|---|---|
| Lead intake, notes, follow-up | Preserve current Odeon workflows; validate any website or external writers | Rehearse conversion on copied/synthetic leads without touching live lead status | Odeon remains owner; do not migrate it back to Opus |
| Staff identity, accounts, permissions | Preserve Odeon identity/access; teaching assignments still follow the operational source | Synthetic accounts first; real-data beta access granted explicitly | Odeon identity remains stable; no duplicate staff on student conversion |
| People, students, family relationships | Operational student roster remains Opus-authoritative until explicit switch; existing Odeon-owned fields retain ownership | Validate identity links, blended households, scoped contacts, siblings | Reviewed canonical identities and relationship access; import rules honor field ownership |
| Services, terms, enrollments | Opus remains authority for live subscriptions and billable terms | Create and change independent enrollments; calculate estimates | Service/term mapping reconciled; date/status history and effective-date behavior accepted |
| Classes, rooms, availability, schedules | Opus remains live scheduling authority until scheduled switch | Rehearse recurring series, capacity, conflicts, holidays, substitutions | Future sessions reconcile; booking protections and staff workflows pass |
| Attendance and delivery | Actual attendance entered in operational source during shadow | Reproduce real days and synthetic exceptions | Reliable session identity and historical roster; an explicit write-authority switch |
| Cancellations, makeups, credits | Verify actual current process, including spreadsheets outside Opus | Test entitlement and redemption against agreed policies | Balances and rules reconciled; no double redemption across systems |
| Financial responsibility, invoices, payments | Existing live billing stays in current system; preserve Odeon funding-case/invoice-workflow ownership separately | Compare charges, allocations, credits, and test-provider outcomes | Reconciled financial opening state, approved payment setup, collection ownership and recovery |
| Funding cases and authorizations | Existing Odeon case management remains; financial ledger gaps are not treated as completed | Test covered services and separately agreed uncovered balances | Authorization/line linkage and independent allocations accepted before financial cutover |
| Customer communications | Existing live Odeon messaging continues on production only; shadow previews do not send | Verify recipients, content, exclusions, and simulated outcomes | Explicit live channel configuration and tested send/reconciliation guards |
| Curriculum and progress | Confirm present source with teachers; no established structured Odeon curriculum model | Validate placement vs achievement and discipline-specific progress | Teacher-approved structure and preserved assessment history |

Before design approval, walk through actual Headliner workflows with the owner/operator. Export labels and source code are not substitutes for this walkthrough.

## 4. Candidate data boundaries (not an executable schema)

Reuse existing people, students, instructors, memberships, customer accounts, and funding concepts. Do not introduce a second person system.

Proposed additions or extensions should support:

- **Source mappings:** tenant + source system + entity type + source ID → canonical ID; include enrollment/session IDs, not only person IDs. A source ID is not assumed unique across tenants or entity types.
- **Baseline/import batches:** source coverage, extraction/import time, mapping version, counts, checked writes, row errors, reconciliation and acceptance state. Partial failure must not publish a verified baseline.
- **Scenario identity:** base batch/version, scenario status, actor, changes, assumptions and calculation-policy version. Every scenario write has an enforceable context.
- **Change requests:** source baseline, target record/version, old/new values, effective date, expected impact, reason, approver, implementer, external result reference, and reconciliation.
- **Domain entities:** services/offerings/enrollments, schedule rules/occurrences/rosters, attendance, policy-backed credits, responsibility allocations, and payment events as their milestones require.

Do not put all future billing/session data into a generic JSON change table. Exact relational models and migrations follow focused implementation briefs.

## 5. Baseline, refresh, and reconciliation contract

1. Obtain an owner-approved export/data inventory and verify the supported Opus extraction options. Do not assume API or saved-payment-method portability.
2. Validate file type, coverage, source IDs, duplicates, references, vocabulary and expected record counts before applying.
3. Import into a candidate baseline with checked writes and explicit errors, not directly over accepted scenario state.
4. Reconcile counts **and** relationships, financial totals where applicable, future sessions and exceptions. Counts alone are insufficient.
5. Publish the candidate as verified only after checks pass. Keep unresolved records visible and excluded from claims requiring them.
6. Rebase scenarios explicitly: show source drift and conflicts; never silently overwrite a hypothetical change. Preserve audit and original baseline references.

M0 must choose a feasible refresh method and cadence that staff can sustain. A controlled initial/final export can be appropriate; frequent manual spreadsheet uploads are not the target operating model. If temporary refresh is too burdensome, narrow the pilot cohort or use a dated rehearsal baseline rather than claim it is live. Automated integration is conditional on verified support and benefit.

Current date-only attendance merging cannot identify two same-day sessions. Preserve source session identity when available; quarantine ambiguous rows rather than invent an identity or merge them silently.

## 6. Live handoff contract (later gated capability)

Proposed lifecycle:

`Draft → Approved → Pending application → Applied → Verified`

Also support `Rejected`, `Cancelled`, `Needs reconciliation`, and `Superseded`. “Applied” is not proof of correct billing or a successful charge.

- A simulation cannot enter this lifecycle without explicit authorized promotion.
- Approval covers a specific change, effective date, estimated impact, and source version. Material edits or live drift invalidate approval.
- Include external student/subscription/session IDs, current/proposed terms, pricing/proration/discount/credit assumptions, assigned operator and deadline.
- Staff apply the change in Opus and attach the resulting authoritative record/reference and actual effect. Do not assume a subscription change immediately charges a card.
- Reconcile the actual result with the proposal. Differences require resolution, not automatic retries.
- Reimports match the existing request; they do not issue a second instruction.
- Cancellation before application differs from correction after application. Sent messages and settled payments are not undone by changing local status.
- No automatic Opus writes are planned until a supported interface and its behavior are verified.

## 7. Beta safety contract

Before enabling any beta access:

- Verify main and CRM databases, Auth, storage, provider configuration tables, mailbox grants, secrets, callback destinations, scheduled jobs and deployment variables.
- No production payment credentials or customer payment tokens; use approved provider test methods only.
- Block real messaging and calendar writes at the integration boundary. For preview sends, use explicit test-recipient allowlisting and isolated test channels.
- Do not point production webhooks at shadow. Jobs and retries must obey the same restrictions as interactive actions.
- Show persistent **Shadow Academy — no live transactions** identity and label all invoices, receipts, estimates and balances as simulated.
- Restrict real-data access by tenant, role and student scope; define retention, export and deletion handling. Real-data beta is not an unrestricted demo.
- Verify cross-environment denial and attempted sends/charges, not just missing local environment keys.

The older synthetic staging refresh rejects Auth users and clears/replaces selected tables. It is **not** approved for a real-data beta with persistent scenarios or authenticated users.

## 8. Day-in-the-life acceptance pack

All early fixtures are fictional. Later real-data rehearsal requires its own approval and access gate.

| Scenario | Required outcome |
|---|---|
| One parent inquires for two children; only one enrolls | Reuse/create reviewed identities, retain source inquiry, separate learner outcomes; retry does not duplicate enrollment |
| Student has private piano and group band | Edit/import one enrollment without hiding or overwriting the other |
| Blended households, pickup-only contact, different sibling access | Correct per-student access and recipients; relationship labels do not grant financial or household-wide rights |
| Instructor also takes lessons | One person, separate profiles and permissions; employment/lesson status changes do not cascade incorrectly |
| Two sessions on one date | Distinct attendance and billing references; no date-only collapse |
| Teacher absence and substitute | Change selected occurrence only; check room/teacher/student conflicts and qualification requirements |
| Vacation, cancellation, makeup redemption | Apply agreed effective policy; preserve original session and ledger; no duplicate entitlement |
| Mid-cycle duration change | Versioned estimate with explicit effective date and proration assumptions; no charge or Opus write |
| Two family payers and a funder | Explicit responsibility, caps and balances; funder failure does not silently assign family debt |
| Corrected export and baseline refresh | Show drift/conflicts; preserve scenario and prior approvals; no false verified status after partial failure |
| Promote selected shadow change | Explicit approval, one pending handoff, external result comparison; drift forces renewed review |
| Payment failure, partial settlement, refund rehearsal | Test-provider/simulated effects only; reconcile events and balances, not a single paid/unpaid flag |
| Day-to-day staff work | Find person/session, make change, understand effects, correct mistake without an undocumented workaround |

Beta journal: scenario, baseline/scenario version, operator, expected/actual result, friction, severity, owner, resolution and retest evidence. Measure common task completion and staff preference against the current workflow; set thresholds after observing baseline tasks rather than inventing targets.

## 9. Delivery sequence and gates

1. **M0 — Ownership/replacement blueprint:** confirm current workflow inventory, first cohort/service, refresh feasibility, environment and source-data evidence, policies and schema plan.
2. **M1 — People, families, services and enrollments:** canonical identity links, relationship scope, explicit multi-enrollment, reviewed lead conversion and compatible imports. Design customer responsibility early; no live tuition collection.
3. **M2 — Classes and core scheduling:** offerings, rosters, availability, rooms, recurrence/occurrences, booking protection, holidays and effective edits.
4. **M3 — Daily operations:** attendance, substitutions, cancellation/rescheduling, makeups and session notes. Preserve historical delivery and policies.
5. **M4 — Financial operations:** priced terms, charge/invoice lines, allocations, payment events, credits/refunds, funder matching and reconciliation in simulation/test mode.
6. **Shadow beta / controlled cutover:** rehearsal grows alongside M1–M4; no need to wait to test each completed workflow. A few weeks is an observation window, not automatic acceptance. Deliberately test month boundaries and rare exceptions.

Curriculum/teacher experience can advance in parallel once identity, enrollment and session boundaries support it. Reliable domain capabilities should support future AI callers, but actionable Highlights/agent execution are deferred until data ownership and staff trust are established. Conventional screens remain first-class.

### Financial/operational switch gate

- Owner accepts representative scenarios and resolved critical defects; staff can perform the agreed daily scope.
- Reconcile identities, active enrollments, future sessions, opening receivables, prepaid value, credits, makeup balances and funding obligations for an explicit cutover timestamp.
- Decide who collects old outstanding balances and who processes post-cutover corrections/refunds for pre-cutover transactions. Do not charge the same obligation in both systems.
- Verify payment-method transfer or customer reauthorization path, supported provider onboarding, test failures/refunds and uncertain-outcome recovery. No raw card export/import.
- Stop conflicting writers and recurring collections for the switched scope before enabling the new collection path. Assign an owner to every in-flight handoff and payment outcome.
- Take approved backups, final delta/reconciliation, readiness sign-off and controlled activation; monitor early operations.
- Preserve historical lookup/export and provider transaction references. After new live financial activity, do not simply flip back to a stale copy; reconcile post-switch effects before any recovery switch.

## 10. M0 completion criteria and immediate next work

**Completed now:** repository-based brief, local configuration classification, documented gaps, revised reading copy and local validation. This is not completion of M0.

**Open before M0 sign-off:**

- [ ] Owner/operator confirms actual workflow inventory and live domain ownership.
- [x] Select first service: recurring private lessons, full student journey (owner selected).
- [ ] Select real beta cohort and required source history; confirm detailed policies and financial acceptance scope.
- [ ] Review a representative source export/schema without storing customer records in Git; establish identity/coverage constraints and feasible refresh.
- [ ] Verify hosted staging schema, restricted access, outbound denial, jobs and recovery through separately approved checks.
- [ ] Choose baseline/scenario storage and environment boundary; approve focused M1 schema/compatibility plan.
- [ ] Confirm won/trial definition, cancellation/makeup rules, effective pricing, family delegation and payer responsibility for pilot scope.
- [ ] Agree staff UX benchmarks and shadow-to-live handoff acceptance.

**Next session:** owner/operator walkthrough plus a narrowly scoped, approved environment/source-data inventory. Do not implement a new migration, destructive refresh or external integration merely because this brief exists.