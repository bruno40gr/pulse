# CharterFlow Domain Alignment

**Status:** Engineering and product terminology guide  
**Date:** October 2, 2026  
**Scope:** Documentation alignment only; this document does not approve a database migration.

## 1. Purpose

CharterFlow's operational requirements are ahead of parts of the implemented funding schema. That is expected during the current foundation phase. The immediate goal is to use one vocabulary, preserve what already works, and avoid encoding unverified Headliner workflows or prematurely redesigning the database.

Use the sources in this order:

1. `odeon-md/CharterFlow_BRD.md` is authoritative for the target domain and product behavior.
2. Applied migrations and current APIs are authoritative for implemented capabilities.
3. Organization-specific operational claims are authoritative only when backed by dated correspondence or explicit staff confirmation.
4. Catalog guidance, fixtures, and hard-coded established-program lists are bootstrap aids, not universal business truth.

## 2. Canonical ownership matrix

| Concept | Owns | Must not own | Target parent |
|---|---|---|---|
| **Funding organization** | Durable identity, aliases, roles, contacts, provenance | A tenant's setup completion; student authorization; invoice responsibility | Catalog/global identity or tenant-scoped copy during MVP |
| **Program / arrangement** | Participating organizations and roles; versioned onboarding, submission, approval, settlement, invoice, and document rules | Headliner-specific vendor identifiers; student exceptions | One or more funding organizations |
| **Tenant affiliation** | Vendor setup status, reusable approvals, vendor IDs, tenant contacts, reusable documents, tenant-specific exceptions | Student authorization; delivered service; invoice payment | Tenant + program/arrangement |
| **Student case** | Student participation, current lifecycle/blocker, case contacts, case-specific overrides | Reusable vendor approval; multiple payments encoded as one status | Student + program/arrangement + tenant affiliation |
| **Authorization** | Reference, covered dates, services/codes, quantities, caps, percentages, approved amount, source document | Program-wide rules; actual invoice settlement | Student case |
| **Invoice** | Service period, lines, generation snapshot, submission/approval events, normalized workflow state | Permanent responsibility inference from one payer field | Student case + applicable authorization(s) |
| **Responsibility allocation** | Party responsible, amount, reason, collectible/write-off classification, settlement state | Submission route or approval ownership | Invoice or invoice line |
| **Payment event** | Amount, date, instrument, reference, source, allocation application | The rules that determined responsibility | One or more responsibility allocations |

## 3. Payment terminology

Always describe payment operations with separate dimensions:

| Dimension | Definition | Current examples |
|---|---|---|
| **Submission mechanism** | How billing information reaches the required destination | Email, upload portal, manual-entry portal, scoped link |
| **Approval workflow** | Reviews or attestations required before settlement | Family attestation, caseworker approval, FMS approval, none |
| **Settlement mechanism** | How value is initiated and moved | External party pushes payment; vendor initiates card charge; reimbursement |
| **Payment instrument** | Rail or instrument used for settlement | ACH, check, prepaid card, virtual card, cash |
| **Payment responsibility** | Party and amount legally or operationally expected to pay | Funding allocation, family uncovered balance, vendor write-off |

Rules:

- Family ownership of an approval or routing action does not imply family payment responsibility.
- A family may owe an uncovered balance even when the funding organization pays the covered allocation.
- “Split payer” should be implemented as responsibility allocations, not as an invoice status.
- “Partially paid” is derived when some collectible allocations are settled and others remain open.
- `recipient_routing`, `submission_route`, and `payment_method` are legacy/transitional labels; new documentation must use the precise dimension intended.

## 4. Current-schema mapping

| Canonical concept | Current implementation | Alignment assessment |
|---|---|---|
| Funding organization | `funding_organizations`; `funding_organization_roles`; catalog key/provenance; contacts | Implemented foundation. Tenant-scoped copies are acceptable for the current single-tenant product but are not yet a shared global identity library. |
| Program / arrangement | `funding_profile_versions`, plus `funding_program_organizations` linking organizations and roles to a profile version | Partial. The active immutable profile version currently acts as the reusable program object. There is no stable program identity independent of version or primary organization. |
| Tenant affiliation | `HEADLINER_ESTABLISHED_FUNDING_CATALOG_KEYS`, `isEstablishedFundingAffiliation`, profile onboarding fields, tenant contacts | Transitional only. Establishment is inferred from tenant ID + catalog allowlist, not stored as durable relationship state. |
| Student case | `funding_cases` references student, funding organization, onboarding/current profile versions; lifecycle and blocker fields | Implemented foundation. Uniqueness is student × organization rather than student × arrangement. |
| Authorization | Scalar `authorization_reference`, start/end dates, `authorized_amount`, `coverage_cap`, `coverage_percent`, `service_codes` on `funding_cases`; compatibility copies in `student_payers` | Transitional. Supports one current authorization-shaped record per case, not renewals or overlapping authorizations. |
| Invoice | `funding_invoices` with amount, service period, status, profile/configuration snapshots, `submitted_at`, `approved_at`, and `expected_pay_date` | Implemented MVP foundation. No first-class invoice lines or approval-event collection. |
| Responsibility allocation | Coverage fields on the case and prose instructions | Not implemented. The schema cannot independently track funder and family balances or settlement states. |
| Payment event | Invoice status events plus `paid_on`; UI calculates aggregate paid/outstanding from invoice status | Partial workflow audit only. It is not an amount-bearing payment ledger and cannot represent multiple or partial settlements. |
| Legacy payer compatibility | `payers`, `student_payers`, `payer_id`, `student_payer_id`, and synchronization writes | Intentional transitional scaffolding required by existing code and historical migrations. Not the canonical organization/program/responsibility model. |

## 5. Transitional fields and naming

Do not perform disruptive renames in the current pass. Interpret fields as follows:

| Existing field or label | Transitional interpretation | Later decision |
|---|---|---|
| `funding_profile_versions.program_name` | Display name for the arrangement represented by this profile version | Decide whether a stable `funding_programs` record is needed before multi-arrangement or multi-version identity becomes operationally important. |
| `recipient_routing` / `submission_route` | Primarily submission mechanism and destination; may currently contain overloaded values | Split only when verified workflows require independent submission, approval, and settlement configuration. |
| `payment_method` | Legacy display/config value that may ambiguously describe mechanism or instrument | Prefer `settlement_mechanism` and `payment_instrument` in future design. |
| Case authorization and coverage columns | Current authorization snapshot for the case | Normalize when renewals, overlaps, multiple service authorizations, or authorization-level invoice matching are required. |
| Invoice `status` | Normalized operational workflow state | Keep small. Derive partial-settlement conditions from allocations rather than adding responsibility-specific states. |
| `funding_invoice_status_events` | Audit trail of workflow status transitions | Retain even if amount-bearing `payment_events` are later added; they answer different questions. |
| `payer_id` / `student_payer_id` | Compatibility links for historical APIs and migrations | Remove only through a separately reviewed migration after all readers/writers no longer depend on them. |

## 6. Confirmed versus unverified workflows

### Confirmed in the implementation

- Funding organization records are tenant-scoped and can hold non-exclusive roles.
- Profile versions are immutable and invoices/cases can retain the applicable profile version or snapshot.
- A funded case can be blocked with an explicit owner and can store student-specific authorization and coverage data.
- Invoices use normalized statuses with auditable status transitions.
- Headliner currently receives immediate assignment access only for catalog keys in a hard-coded established list.
- Catalog records distinguish entity verification from operational-rule verification.

### Requires correspondence or staff confirmation

- Exact submission destination and venue for each Headliner arrangement.
- Exact order and owner of family, caseworker, FMS, or administrator approval steps.
- Whether a card is family-held, vendor-held, or pushed by an administrator, and whether it is a settlement instrument or part of another workflow.
- Exact amount tiers, cutoff dates, missed-deadline behavior, and expected-payment formulas.
- Whether vendor approval is reusable across all arrangements under an organization or only a specific program.
- Whether families ever owe uncovered balances in Headliner's real funded cases and how those balances are invoiced and collected.
- Whether one student can have overlapping or renewed authorizations that must coexist.
- Whether a single invoice can span multiple authorizations or responsibility parties.

Until verified, UI copy and catalog guidance should say “needs review,” preserve provenance, and avoid presenting examples as contractual rules.

## 7. Migration risks

1. **Creating `funding_programs` too early.** The stable identity boundary is not yet proven. A program might represent one profile lineage, a named funding product, or a multi-organization arrangement.
2. **Creating tenant affiliations from the allowlist without workflow evidence.** A boolean `established` field may be too small if setup has identifiers, documents, effective dates, renewal, capacity, or arrangement-specific approvals.
3. **Normalizing authorizations before invoice matching is understood.** Premature tables can encode the wrong cardinality between authorization, service code, enrollment, invoice line, and service period.
4. **Adding “family payer” or “partially paid” as statuses.** This conflates responsibility with workflow and makes split balances difficult to reconcile.
5. **Replacing status events with payment events.** Status transitions and monetary settlement are separate audit trails; future payment tables should complement, not overwrite, existing history.
6. **Removing legacy payer fields in the same migration.** Current APIs and RPCs still create and synchronize compatibility payer records. Removal must follow reader/writer migration and verification.
7. **Encoding organization examples as enums or branches.** Organization-specific behavior belongs in evidence-backed configuration, not API conditionals.

## 8. Deferred entities and trigger conditions

These are candidate entities, not approved schema work:

| Candidate | Add when |
|---|---|
| `funding_programs` and version lineage | One organization has multiple arrangements, one arrangement has multiple participating organizations, or profile versions need a stable parent identity in APIs and reporting. |
| `tenant_funding_affiliations` | Setup state, vendor identifiers, reusable approvals/documents, renewal, or arrangement-specific contacts must persist independently of a profile version. |
| `funding_authorizations` | Cases need renewals, overlaps, multiple service codes/limits, authorization documents, or invoice matching to more than one authorization. |
| `funding_invoice_lines` | Generated invoices need service/date/code detail, aggregation, source-ledger traceability, or allocation below invoice total. |
| `funding_responsibility_allocations` | Funder and family amounts need independent balances, due dates, collection states, or write-offs. |
| `funding_payment_events` and applications | Partial, multiple, reversed, or cross-allocation payments must be recorded with amount and instrument. |
| Approval/submission event tables | More than one approval, resubmission, venue, actor, or timestamp must be retained per invoice. |

## 9. Validation checklist before schema design

For a representative set of active Headliner cases, collect dated evidence and answer:

1. Which organizations participate, and what role does each play?
2. What arrangement is the student actually enrolled or authorized under?
3. What vendor-level setup is reusable, for how long, and under which arrangement?
4. What authorization fields can change or repeat during one case?
5. How is billing submitted, to whom, in what venue, and in what format?
6. Who approves, in what order, and what evidence or timestamp is available?
7. Who is responsible for each dollar, including uncovered family balances?
8. Who initiates settlement, and what instrument carries it?
9. Can settlement be partial, batched, reversed, retried, or applied across invoices?
10. Which fields must be frozen on the invoice for auditability?

Only after these answers expose repeated cardinality or reporting needs should engineering propose migrations for programs, affiliations, authorizations, invoice lines, allocations, or payment events.

## 10. Immediate engineering guardrails

- Keep existing API and table names stable during the terminology pass.
- Preserve legacy payer writes until a dedicated compatibility-removal plan exists.
- Treat the Headliner established-program list as bootstrap configuration, not canonical affiliation data.
- Prefer comments, type wording, and documentation over speculative schema changes.
- Keep organization-specific rules provenance-bearing and reviewable.
- Add future schema in small, additive migrations with backfill and verification plans.
- Re-run lint, build/type validation, and the funding workflow verifier after any runtime or migration change.