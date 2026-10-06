# Odeon foundation and commercialization roadmap

**Date:** October 4, 2026
**Status:** Approved roadmap; implementation and milestone completion remain pending.

## Guiding rules

- Continue Headliner feature development alongside bounded foundation work.
- Fix demonstrated risks to existing data now.
- Build commercial capabilities when an external pilot is scheduled—not speculatively.
- Advance on **acceptance criteria**, not elapsed time.
- **External customer data is a milestone separate from payment.** A free pilot must pass the data-isolation gate.
- Assume the first payment is **a school paying Odeon for SaaS**. Collecting tuition for schools requires a separate payment-model review.
- Production exposure has not been established by local mocked tests. Verify deployment configuration before assigning same-day urgency; do not reproduce unauthorized data access against production.

## Sequence at a glance

| Phase | Horizon | Milestone | Required before moving on |
|---|---|---|---|
| **1. Protect Headliner** | Short term: next 1–2 weeks | Current application is safely operated | Exposure checked; containment and focused regression tests pass |
| **2. Prepare external pilot** | Mid term: when school #2 is scheduled | First external school can use real data | Tenant isolation, provisioning, migrations, recovery, and data terms ready |
| **3. Commercial launch** | Mid term: after pilot preparation | **First paying customer** | Phase 2 gate plus billing lifecycle, operational readiness, and commercial review |
| **4. Grow deliberately** | Long term: after paid pilot | Repeatable onboarding and measured expansion | Pilot is stable; capacity and reliability meet the next workload |

**Phases 2 and 3 can overlap. Their release gates cannot be skipped.** Checkboxes below track implementation; none is marked complete merely because this roadmap exists.

## Phase 1 — Protect Headliner

**Purpose:** repair existing exposure without building future-school infrastructure.

**Implementation note (October 4, 2026):** the reviewed default-tenant repair is implemented locally with synthetic regression tests. Deployment verification and staging acceptance remain pending. See `/Users/brunowong/pulse/docs/tenant-selection-repair.md`. Phase 1 is not complete.

### Tasks

- [ ] Verify active production commit, configured authentication secrets, demo availability, database targets, and Twilio callback configuration. Record variable names and configuration state—not secret values.
- [ ] **Close the default-tenant authorization gap on affected handlers.** Derive the tenant server-side from the authenticated actor and authorize every affected method. Blocking demo alone is insufficient: `middleware.ts:88-106` only rejects a mismatching `tenant` when the parameter is present, and handlers such as `app/api/staff/route.ts:6-9` and `app/api/history/route.ts:7-10` default a missing parameter to Headliner without consulting the actor. So any authenticated actor (demo session, legacy session, or a future tenant-#2 member) can omit `tenant` and reach Headliner-scoped reads and writes. This is latent cross-tenant access today and becomes live exposure the moment a second tenant has real data.
- [ ] Validate inbound SMS signatures before writes; remove sensitive message logging.
- [ ] Bind public intake to Headliner server-side and prevent unverified submissions from overwriting canonical contact identity.
- [ ] Remove authentication-secret/password fallbacks.
- [ ] Fix demonstrated contact permission and related-record ownership gaps.
- [ ] Correct known import write-error handling and inaccurate success reporting.
- [ ] Assess Next/Axios advisories and make targeted, tested dependency upgrades in a separate branch. Do not blindly run forced upgrades.
- [ ] Land each repair with a focused regression test; do not delay containment to build a test framework.
- [ ] Verify current backup coverage and identify the recovery owner.
- [ ] Add minimal agent instructions covering security invariants and dangerous scripts.

### Urgency decision

- **Fix today:** vulnerable deployed handlers are reachable through public demo entry against real data; authentication fallbacks are in use; or an unsigned webhook is publicly deployed against real records.
- **Fix this week:** production is demonstrably contained, but unsafe code remains.
- Configured secrets remove the fallback-secret condition; they do **not** close the default-tenant authorization gap, which affects any authenticated actor—not demo alone.

### Gate: safe Headliner operation

Move on when:

- No authenticated actor can reach a tenant it does not belong to by omitting or manipulating the tenant parameter, including via the Headliner default. Denied for demo, legacy, other-tenant, and suspended actors.
- Invalid webhook signatures cause zero writes.
- Public intake cannot replace another contact’s identity.
- Missing required authentication secrets fail closed.
- Tested contact operations enforce permissions and related-record ownership.
- Relevant dependency findings are patched or have documented applicability decisions.
- Repairs are deployed and validated; production configuration is recorded.

**No full refactor, queue platform, DB consolidation, or billing implementation required.**

### Evidence anchors

- `/Users/brunowong/pulse/middleware.ts`
- `/Users/brunowong/pulse/lib/access.ts`
- `/Users/brunowong/pulse/app/api/contacts/route.ts`
- `/Users/brunowong/pulse/app/api/contacts/[id]/route.ts`
- `/Users/brunowong/pulse/app/api/intake/route.ts`
- `/Users/brunowong/pulse/app/api/twilio/webhook/route.ts`
- `/Users/brunowong/pulse/app/api/staff/route.ts`
- `/Users/brunowong/pulse/app/api/history/route.ts`
- `/Users/brunowong/pulse/app/api/tenant/route.ts`
- `/Users/brunowong/pulse/package-lock.json`

These identify source reviewed for the roadmap, not certification of the active production deployment. Recheck current code before implementation; line numbers and dependency findings can change.

## Phase 2 — Prepare the first external school

**Start trigger:** an external school has agreed to a pilot and an onboarding window is scheduled.

**Do not wait for payment to finish this phase.**

### Tasks

- [ ] Make login and provisioning tenant-neutral.
- [ ] Give external staff individual accounts; remove legacy cross-tenant access.
- [ ] Decide whether users can belong to multiple schools.
- [ ] Define school roles and permissions; require privileged-account MFA.
- [ ] Declare policy for every API method and test denied access—not just helper presence.
- [ ] Scope record operations and related-record links to authorized tenants.
- [ ] Move onboarding-blocking Headliner assumptions into configuration: branding, timezone, services/pricing, integrations, and applicable funding affiliations.
- [ ] Keep demo operations separate from real customer operations.
- [ ] Establish a reproducible schema baseline and tracked migrations.
- [ ] Restore databases into an isolated environment and verify required data/assets.
- [ ] Define support ownership, incident handling, access to customer records, and basic monitoring.
- [ ] Start counsel review of contracts, data processing, subprocessors, retention, and insurance.
- [ ] Schedule independent auth/tenant security review early enough to fix findings before external data is accepted.

### Gate: first external school may hold real data

- A synthetic second school can be provisioned without source edits.
- Its users cannot read or mutate Headliner data, and vice versa.
- Authentication, permissions, exports, and integrations are correctly scoped.
- Required configuration does not silently inherit Headliner policy.
- Database setup and recovery have been demonstrated.
- Appropriate customer/data terms are reviewed before external data is accepted.
- Independent review has no unresolved findings designated as launch blockers.

### Cheap seams to preserve now

Reuse the existing tenant context; add focused synthetic fixtures and explicit route policies as Phase 1 repairs land. **Do not build self-service onboarding now.**

## Phase 3 — First paying customer

**Start trigger:** pricing and the SaaS payment model are agreed, and a paid launch is scheduled.

**Milestone:** first live charge.

### Before payment integration

- [ ] Confirm SaaS billing versus tuition/platform collection.
- [ ] Choose provider and hosted payment collection.
- [ ] Define provider-to-tenant mappings and entitlement rules.
- [ ] Keep billing separate from funding invoice-status tracking.

### Before first live charge

- [ ] Select prices server-side.
- [ ] Verify and durably deduplicate payment webhooks.
- [ ] Make checkout/refund commands retry-safe and idempotent.
- [ ] Grant entitlements from verified provider state—not the browser redirect.
- [ ] Handle failed payment, cancellation, refunds, and disputes.
- [ ] Reconcile local billing with provider state.
- [ ] Test duplicate, delayed, out-of-order, and failed events.
- [ ] Complete customer export/deletion procedures and support runbooks.
- [ ] Finish commercial, privacy, security, and insurance review appropriate to the business.
- [ ] Ensure contractual claims match demonstrated controls.

### Gate: first paying customer

**All Phase 2 criteria plus:**

- Payment lifecycle tests pass.
- No card numbers/CVC enter Odeon APIs, database, logs, or AI inputs.
- Billing/entitlements reconcile correctly.
- Refund and support ownership are clear.
- Required agreements are completed.
- Recovery and incident procedures are usable.

Hosted checkout reduces payment-data exposure; **PCI obligations and legal applicability require professional review, not assumptions.** Do not assert personal liability or COPPA/FERPA applicability from source code alone.

**Self-service signup, sophisticated metering, and automated sales onboarding are not prerequisites.**

## Phase 4 — Stable pilot, then measured growth

**Start trigger:** the first paying school is operating successfully.

### First milestone: repeatable paid onboarding

- [ ] Onboard another school using the same checklist without code changes.
- [ ] Review pilot errors, support load, data correctness, and billing reconciliation.
- [ ] Confirm monitoring detects operational failures.
- [ ] Run a timed recovery exercise.
- [ ] Agree the next growth target: schools, users, records, imports, and campaign volumes.

### Promote work only on evidence

| Deferred work | Promotion signal |
|---|---|
| Pagination/query optimization | Incomplete lists, excessive payloads, or sustained list latency above the agreed target |
| Staged imports | Execution-limit failures, partial imports, or operationally unacceptable recovery |
| Durable outbound jobs | Send/persistence ambiguity, duplicate sends, retry problems, or provider-limit failures |
| Auth-user lookup optimization | Invitation latency or global enumeration becomes material |
| AI budgets/quotas | Spend or abuse exceeds the agreed budget |
| Larger module refactoring | Repeated defects or change friction in the same boundary |
| DB consolidation | Cross-store integrity/recovery problems justify migration |
| Regional redundancy | Demonstrated availability requirements justify cost and complexity |

**School count alone is not a capacity measure.** If a promotion signal already affects Headliner, address it then; do not wait for Phase 4 solely because of this sequence.

### Gate: expand beyond the pilot

The current workload is stable, recovery is measured, onboarding is repeatable, and the next expected workload has been tested.

## Do this week / Before money / Ignore for now

### Do this week

Verify deployment exposure; contain demo access; sign inbound SMS; fix intake overwrite; remove credential fallbacks; attach regression tests; assess targeted dependency upgrades.

### Before external data

Finish tenant isolation, individual accounts, provisioning/configuration, reproducible migrations, proven recovery, customer-data terms, and security review.

### Before the first paying customer

Finish the preceding gate **and** payment lifecycle, reconciliation, refunds, commercial agreements, and operating procedures. **This milestone lands in Phase 3.**

### Ignore for now

Microservices, multi-region, broad rewrites, speculative DB consolidation, self-service sales onboarding, and scale infrastructure without a measured need.

## Maintaining this roadmap

- Mark tasks complete only with a linked change, test result, or documented operational verification.
- Revisit scope when an external pilot is scheduled, the payment model changes, or a promotion signal occurs.
- Preserve unrelated in-flight Headliner edits when implementing repairs; no blanket resets or prerequisite commits of unfinished features.
- Never put secret values or real customer records in this document or its supporting test fixtures.