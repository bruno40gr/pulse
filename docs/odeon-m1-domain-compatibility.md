# M1 — People, relationships, services and enrollments

**Date:** October 26, 2026\
**Status:** Schema/compatibility proposal with an initial pure-domain implementation; not a migration specification or M1 completion certificate.
**Authorization:** Owner requested progression to M1. This advances design and synthetic acceptance planning; it does not waive the unresolved M0 safety/source gates.\
**Workflow evidence:** `/Users/brunowong/pulse/docs/odeon-m0-private-lessons.md`\
**Acceptance plan:** `/Users/brunowong/pulse/docs/odeon-m1-acceptance-plan.md`

**Integration requirements:** `/Users/brunowong/pulse/docs/odeon-m1-integration-spec.md` traces current callers, atomic command requirements, import acceptance units and evidence gates. It is not executable migration SQL.

**Staging evidence update:** `/Users/brunowong/pulse/docs/odeon-m1-staging-schema-findings.md` records an approved, targeted metadata-only inspection. Both instructor columns exist in staging and target different tables. This partially resolves staging structure only; it does not establish production compatibility or waive the remaining schema/isolation gates.

**Staff-as-student experiment:** `/Users/brunowong/pulse/docs/odeon-m1-role-identity.md` documents a fictional local PostgreSQL rehearsal of shared person identity and consistent teacher-role references. Its constraints are not an application migration or a decision on the authoritative instructor column.

## 1. Scope and implementation boundary

Deliver the foundation for a synthetic recurring-private-lesson student journey:

- One person identity with compatible student, instructor and contact relationships.
- Student-specific adult relationships, household grouping when useful, and explicit responsibility references—not inferred access from contact fields.
- Multiple independently addressable enrollments per student.
- Service definitions, payment-plan terms and reusable named offers, with versioned accepted terms.
- Reviewed inquiry-to-person/enrollment linking and source identity/provenance.
- Contacts/import compatibility that cannot silently select or overwrite an arbitrary enrollment.

M1 does **not** deliver recurrence/occurrences (M2), attendance/makeup execution (M3), invoicing/collections (M4), a parent portal, autonomous agents or live Opus integration. Show enrollment schedule intent if useful, but never represent it as a conflict-checked booking. Preserve the later domains' boundaries in the design now.

Before SQL or database-backed implementation: verify the approved target's actual schema, migration history, RLS/grants, identity constraints and recovery; resolve baseline/scenario storage; review representative source headers/IDs; approve the resulting executable migration and backfill specification. No hosted verification or source-data access is authorized by this document.

## 2. Repository compatibility evidence

These observations describe local code, not verified hosted state:

| Evidence (absolute path) | M1 consequence |
|---|---|
| `/Users/brunowong/pulse/app/api/contacts/route.ts`: people → students → enrollments join; first enrollment flattening; `instructor_person_id` read/import | Expose all enrollments; replace first-element assumptions; reconcile actual instructor FK before choosing the write contract |
| `/Users/brunowong/pulse/app/api/contacts/[id]/route.ts`: `.single()` enrollment lookup; writes `instructor_id` and enrollment custom fields | Explicit enrollment selection and schema-consistent writes; ambiguous legacy mutations must fail before any partial person/account update |
| `/Users/brunowong/pulse/lib/csv-parser.ts`: contact-level external ID; date-oriented attendance | Not a complete subscription/session import contract; preserve raw evidence outside Git and quarantine ambiguous rows |
| `/Users/brunowong/pulse/scripts/migration-001-student-accounts.sql`: historical `student_accounts`, `staff`, enrollment staff FK | Do not rerun as a baseline or create a second instructor identity. Verify which structures actually exist |
| `/Users/brunowong/pulse/scripts/migration-024-account-people-of-contact.sql`: account contacts/funding links | Reuse where appropriate, but contact designation does not establish guardian access or payment responsibility |
| `/Users/brunowong/pulse/lib/tenant-request.ts`: verified membership/permission request boundary | Reuse authorization pattern; supplied tenant/context IDs select records but do not authorize them |
| `/Users/brunowong/pulse/docs/charterflow-domain-alignment.md` | Keep customer accounts separate from funding organizations; preserve existing funding APIs and legacy compatibility writers |
| `/Users/brunowong/pulse/docs/odeon-m0-readiness.md` | Hosted state unverified; destructive staging refresh is not a baseline/scenario solution |

## 3. Logical model proposal

Names below are conceptual, **not approved new table names**. Inspect/reuse existing structures before introducing equivalents. Every tenant-owned link must validate both endpoints' tenant and operating context, including service-role writes.

| Concept | Identity/cardinality and required meaning |
|---|---|
| Person | Preserve existing person IDs; student/instructor/contact are compatible roles/links, not exclusive global person types. Shared email/name/phone is not a unique person key |
| Student / instructor | Preserve existing role records and person links; one instructor may also be a student. Do not recreate staff/Auth membership as part of enrollment |
| Adult–student relationship | Explicit adult person + student, descriptive relationship, validity/status and provenance. Student-specific actions/access are separate from the label; pickup permission does not imply billing or portal access |
| Household grouping | Optional grouping, not mandatory identity or authorization scope. A child can have adults in different households; do not force a family into one account |
| Customer account / responsibility | Preserve existing account IDs and funding links. Identify agreed responsible customer context without implying all contacts are payers. Do not invent percentage allocations or replace funding organizations with customer accounts; unresolved responsibility blocks final financial terms, not identity capture |
| Service definition/version | Named lesson/service with configurable instrument, duration and delivery parameters; pricing/payment plan separate. No unique constraint that prevents one student taking the same service more than once |
| Payment-plan template/version | Single visit, visit pack, recurring visits/recurring payments, or recurring visits/one-time payment. Store entitlement basis, recurrence intent, pricing basis and payment cadence distinctly; do not hard-code Headliner's monthly plan globally |
| Enrollment | Stable ID, student, service/version, lifecycle, effective operating dates, instructor person/role reference and responsible customer reference where known. Allow multiple concurrent enrollments; identify every mutation by enrollment ID |
| Accepted enrollment terms/version | Effective period, currency, applicable rate/amount, duration/visit basis, plan version and policy references, with actor and acceptance provenance. No silent repricing from a template edit; preserve historical versions |
| Saved offer/version | Tenant-scoped ID, reusable name, explicit fixed price / fixed-amount discount / percentage discount, scope and configured eligibility/validity/usage/stacking terms. Names are not unique business keys or behavior switches |
| Offer application | Link a particular offer version and accepted calculation terms to a specific booking/enrollment/eligible scope. Reuse one definition across applications; edits/archive do not rewrite history. Future recurring application must be explicit, not implied by reuse |
| Source identity and import run | Tenant + source system + entity type + stable external ID → canonical identity, with extraction/coverage/version provenance. Mapping is persistent across refreshes, never regenerated per import. Same-source conflicting mappings require review |
| Inquiry conversion link | Preserve inquiry/lead and link reviewed learner/adult identities and chosen enrollment(s). Won/trial states are not implicit evidence of paid enrollment; preserve CRM ownership |

### Constraints to make executable in the migration specification

- Tenant/context-consistent references and uniqueness; no cross-tenant instructor, relationship, offer or source mapping.
- Enrollment effective ranges and accepted-term versions cannot conflict under the agreed effective-time convention. Currency and money representation must be explicit; use decimal/minor-unit arithmetic, not floating-point financial totals.
- Offer calculation mode determines allowed values; validate percentages and monetary bounds. Do not treat a price override as an amount-off discount or allow an unintended negative payable amount.
- Archived definitions remain referentially valid for history; do not cascade-delete accepted terms, applications or delivery evidence.
- Mutations carry expected versions; stale edits fail without silently overwriting another staff member's change. Record actor, context, old/new terms and reason.
- Multi-record conversion/import changes need an atomic accepted unit, with checked errors. A success counter or sync timestamp must not advance for unaccepted writes.

## 4. Headliner terms to preserve, not execute prematurely

- Ordinary recurring tuition: applicable lesson rate × teachable lesson dates in the month; configured closures excluded. Mid-month start counts remaining dates only.
- Initial-month collection on enrollment; ongoing collection on the first for that month's lessons. Due/attempted is not paid. M1 stores accepted terms, not live collection jobs.
- Timely parent cancellation creates a makeup; under 24 hours normally forfeits, subject to explicit staff leniency. Same notice rules for booked makeups.
- Teacher cancellation: substitute first; otherwise contact parents and owe a makeup. Next month's ordinary tuition is not automatically reduced by owed makeups.
- Makeup expiry: six months from issuance; lesson takes place before expiry. Cancel/rebook preserves issuance/expiry. Platform also permits no-expiry policies.
- Another instructor, sometimes grouped/cross-instrument delivery, with 1:1 redemption per student. Original obligation and actual delivery stay separate.
- Monetary/percentage offers are configurable and reusable under saved names. No particular promotion must be finalized to complete model review.

Store versioned policy references/accepted terms only as needed in M1. Do not add a speculative full makeup or financial ledger in this slice. Exact cutoff/timezone, no-show handling, extensions and other unresolved edge cases remain in the workflow brief.

## 5. Reader/writer compatibility contract

### Contacts and enrollment editing

1. Add an explicit enrollment collection with IDs and lifecycle/effective context; preserve person/account fields needed by existing clients.
2. Legacy flattened fields may project only an unambiguous eligible enrollment, with its ID. For multiple candidates, expose ambiguity/selection required; never pick array index zero. Review consumers before changing response shape.
3. Enrollment writes require an ID. Temporary legacy compatibility may infer it only when exactly one eligible enrollment exists; otherwise return a documented validation/conflict response **before any mutation**.
4. Resolve instructor IDs through verified person/role links. Do not accept a `staff_id`/person-ID fallback as interchangeable; unresolved mappings are visible errors, not guessed FKs.
5. Validate and commit person/account/enrollment changes as a reviewed atomic operation or separate explicit commands. Do not report a successful edit after an unchecked child write.

### Import and refresh

- Require reviewed source contracts with student and subscription identity. Reimport of the same source enrollment is idempotent; another subscription creates another enrollment, not an overwrite.
- Contact-only legacy imports may update compatible contact fields but cannot infer an authoritative enrollment from names or instructor strings. Preview/quarantine enrollment ambiguity before writes.
- Same-day attendance without session identity stays non-authoritative legacy evidence; do not turn it into delivered occurrences or merge distinct lessons into one record.
- Report accepted, rejected, unchanged and unresolved rows plus reconciliation/coverage, not just imported contact counts. Absence from an export is not deletion without an approved complete-scope contract.
- Persistent baseline/scenario isolation is a prerequisite for real operational import. A refresh cannot erase scenarios, mutate approved handoffs or promote hypothetical terms into live records.

### Existing live workflows

- CRM/communications: preserve person/inquiry links, opt-out and message-routing behavior. A new contact/relationship does not authorize sending. No automatic outreach during conversion/import.
- Staff access: preserve memberships, roles and grants. Parent relationship records do not create Auth users or staff membership.
- Funding: preserve account/case/invoice/contact references and legacy compatibility fields; any new responsibility structure needs its own reviewed transition. No funded record should be recategorized as private-pay from a missing export field.
- Insights: do not make Highlights authoritative or re-enable agent execution as part of enrollment work.

## 6. Context and safety design gate

Choose an isolated synthetic operational store initially; do not assume adding a scenario badge protects shared live tables. Before implementing storage, decide whether isolation uses separate databases/schemas or enforced context keys, and verify server, privileged and browser boundaries accordingly.

Every operational command must resolve authorized tenant + context + baseline/scenario version. Shadow writes target only that scenario; live CRM identity reuse requires a reviewed mapping and read boundary, not implicit writes to live people. No default-to-live context, provider fallback, callback execution or scheduled collection from synthetic terms.

## 7. Proposed delivery order

1. **Review this logical model and acceptance plan.** Confirm the compatibility approach; keep M0 gaps explicit.
2. **Obtain separately approved schema/source evidence and storage decision.** Produce exact column/FK/RLS and migration-history inventory without customer records in Git.
3. **Write executable additive migration/backfill design.** Map existing IDs, quarantine ambiguity, specify rollback limits, recovery and compatibility projections. Do not replay historical SQL wholesale.
4. **Implement pure validation/adapters with synthetic fixtures**, followed by an isolated schema rehearsal. Read the installed Next.js guides before route/UI work.
5. **Migrate readers then guarded writers** in the isolated rehearsal, including Contacts, imports, conversion and funding/access regression checks. No drop/rename of compatibility fields in the same release.
6. **Validate and review M1 completion**, then move to M2 occurrences and conflict-safe scheduling. Real-data beta and live authority remain separate gates.

## 8. Review/sign-off checklist

- [ ] Logical entities/cardinality and responsibility/access distinction accepted.
- [ ] Exact target schema, FK/constraint/RLS and applied migration evidence approved.
- [ ] Source student/subscription/session identity and import coverage reviewed.
- [ ] Synthetic/baseline/scenario storage, access and recovery chosen and verified.
- [ ] Exact instructor FK and legacy Contacts compatibility contract approved.
- [ ] Atomicity, idempotency, concurrency and quarantine design reviewed.
- [ ] Acceptance cases implemented and executed with evidence; existing CRM/access/funding regressions pass.
- [ ] Staff can inspect two enrollments and their distinct accepted terms without an arbitrary flattened view.

**Current result:** M1 pure-domain implementation started; schema, integrated application behavior and M1 completion are not claimed. Existing roadmap HTML/PDF remain an earlier reading copy; this brief and its companion acceptance plan carry the new M1 detail.

## 9. Implemented pure-domain slice

`/Users/brunowong/pulse/lib/academy-domain.ts` provides:

- Explicit scoped enrollment selection, with single-candidate legacy compatibility and rejection of ambiguity, duplicate identity and tenant/context/student mismatch. The caller supplies already-authorized scope and eligible rows; this helper does not authorize or select lifecycle dates.
- Strict parsing of four initial payment-plan shapes. Recurrence remains separate; prepaid recurring terms currently require an explicit visit quantity. Term-date expansion, additional cadences and monetary calculations are not implemented.
- Saved-offer parsing: fixed promotional price, fixed-amount discount and percentage discount; explicit visit/period count, name, tenant, version and archive state. Money uses safe integer minor units; percentages use integer basis points. Currency validation checks format only, not supported currencies or currency exponents.
- Immutable copied offer-term snapshots for enrollment targets, with tenant, archive and expected-version checks. This is not a persisted application: eligibility, dates, stacking, actor/acceptance, supported currencies, idempotency and financial calculations remain integration work. Booking-target applications are not implemented in this slice.

No route/UI imports these helpers yet. No hosted schema assumption or provider side effect was introduced. Other service shapes/advanced terms must extend these initial contracts explicitly rather than silently discard unknown fields.

Validation: `/Users/brunowong/pulse/scripts/academy/domain.test.cjs` passed 22 tests; existing tenant-selection suite passed 74 tests (96 total, zero failed/skipped). TypeScript, targeted ESLint and `git diff --check` passed. The installed Next.js package does not contain `node_modules/next/dist/docs/`; its README was inspected and no framework APIs were used or modified.

## 10. Implemented source-identity preview slice

`/Users/brunowong/pulse/lib/academy-import-preview.ts` previews an explicit normalized student/subscription identity contract against supplied mappings in one tenant/context/source-system scope. It does not use or change the existing CSV parser/import route.

- Stable existing subscription mapping → matched canonical enrollment; another subscription for the same student → separate creation candidate, without generating an ID or writing a record.
- Missing/malformed IDs, unknown students, duplicate batch subscriptions and student-ownership conflicts → quarantined source rows. Every occurrence of a duplicate subscription is quarantined, including a valid row whose duplicate has a malformed student reference.
- Invalid, duplicate or out-of-scope mapping inventories abort the preview instead of silently choosing a mapping. Canonical enrollment ownership cannot conflict across supplied subscription mappings.
- Opaque IDs remain case-sensitive; no name/email matching, whitespace aliasing, source absence deletion or date-only session inference. Results preserve normalized input positions and immutable counts/rows.

**Limits:** the caller must supply approved normalized IDs and complete mappings for the requested scope. Preview consistency does not prove database ownership, source coverage, persisted idempotency or authorization. A matched identity is not evidence of unchanged terms. New student creation, source-specific CSV field adapters, terms comparison, extraction/run provenance, deletion policy and atomic writes remain unimplemented. Context-local canonical targets must eventually be reconciled with the chosen baseline/scenario storage architecture; this helper does not decide that architecture.

Validation: `/Users/brunowong/pulse/scripts/academy/import-preview.test.cjs` passed 16 new synthetic tests. Combined domain, preview and tenant-selection suites passed **112 tests**, zero failed/skipped; TypeScript, targeted ESLint and `git diff --check` passed. No hosted queries, provider actions, migrations or live-route changes occurred.

## 11. Implemented effective-dated enrollment-term proposals

`/Users/brunowong/pulse/lib/academy-enrollment-terms.ts` adds immutable enrollment terms and a pure change proposal. It copies service/plan version references, parsed payment-plan terms, explicit currency/minor-unit amount, actor attribution and reason. Existing saved-offer snapshots remain separate; attaching and validating offer applications is not implemented here.

The proposed effective-date convention is **inclusive start, exclusive end**, with `null` meaning no end. Actual calendar dates validate without local-time parsing or date rollover. Ordered histories reject duplicate/decreasing versions, out-of-order dates, scope mismatches and overlaps; gaps are permitted and do not imply full coverage or paused enrollment.

An initial proposal requires expected version zero and next version one. Later proposals require the supplied latest version and its immediate successor. For an open predecessor, the proposal includes an explicit close-at date without mutating the old snapshot. The database integration must eventually compare the version, close the predecessor, append the new terms and record audit atomically. Merely calling this helper does none of those writes.

**Limits:** this date convention awaits schema review. The helper accepts append-only effective-date changes, not same-day replacements or historical correction insertion. It reads no clock and cannot enforce today's date or retroactive-change policy. It does not verify external references, supported currency/exponents, responsibility, permissions, acceptance evidence, offer eligibility, duration, schedule occurrences, invoice calculations or settlement. Its `recordedBy` field is attribution, not authentication. The amount is governed by the explicit payment-plan pricing basis; this is not a full commercial-terms schema.

Validation: `/Users/brunowong/pulse/scripts/academy/enrollment-terms.test.cjs` passed **18 new tests**; combined academy and tenant-selection suites passed **130 tests**, zero failed/skipped. TypeScript, targeted ESLint and `git diff --check` passed. No framework API, route, UI, migration, hosted database or provider behavior changed.