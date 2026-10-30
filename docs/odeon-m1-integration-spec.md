# M1 — Enrollment integration specification

**Date:** October 26, 2026\
**Status:** Repository-grounded compatibility requirements; blocked for database implementation. Not executable migration SQL or approval for live changes.

## 1. Plain-English outcome

A staff member must be able to see a student's separate lesson enrollments, choose one, inspect its agreed terms, and change only that enrollment. Importing another subscription must not overwrite the first. Rejected edits must not leave half-saved contact information. Rehearsals must remain separate from live operations and must not send messages or collect money.

The existing pure helpers validate pieces of this outcome. They are not wired into the application. This specification describes the missing integration, not delivered functionality.

## 2. Current callers and compatibility hazards

Evidence below is from local source, not hosted schema inspection.

| Absolute path | Observed behavior | Required integration change |
|---|---|---|
| `/Users/brunowong/pulse/app/api/contacts/route.ts` | GET flattens `students[0].enrollments[0]`; instructor resolution reads `instructor_person_id` | Return addressable enrollment summaries; no array-order selection; resolve instructor references only through verified mappings |
| `/Users/brunowong/pulse/app/api/contacts/[id]/route.ts` | PATCH updates people/students before `.single()` enrollment selection; writes instructor ID separately and lesson fields into custom fields | Resolve and validate the complete command before any mutation; perform the accepted command atomically; reconcile real-column/custom-field authority |
| `/Users/brunowong/pulse/components/contacts/ContactSlidePanel.tsx` | PATCH sends contact fields without an enrollment selector | Add explicit enrollment selection and expected revision for enrollment changes; preserve unsaved input on conflict |
| `/Users/brunowong/pulse/components/contacts/BulkEditPanel.tsx` | Same PATCH body per person; increments success after fetch without checking HTTP status | Require per-person enrollment selection for enrollment fields; show actual accepted/rejected counts and errors; never silently apply to all enrollments |
| `/Users/brunowong/pulse/components/contacts/CSVImporter.tsx` | Splits CSV into 100-row HTTP batches and aggregates returned created/updated counts | Subscription identity/duplicate validation must cover the complete normalized run, not only individual HTTP chunks; durable run/row outcomes required before reporting success |
| `/Users/brunowong/pulse/lib/instructors.ts` | Name/alias/token matching can return or create an instructor identity | Do not call this mutating resolver from the pure shadow preview; approved source mappings must distinguish ambiguous instructors without name-based guessing |
| `/Users/brunowong/pulse/components/funding/FundedCasesWorkspace.tsx` | Fetches contact detail by student person ID | Preserve person/student/account IDs and existing funding-facing response fields; verify funding routing independently of enrollment selection |

The import endpoint also merges attendance by date, performs multiple separate writes and updates `last_synced_at`. None of these establish session identity, atomic subscription acceptance or complete source coverage.

## 3. Proposed read and command behavior

These are implementation requirements, not an existing API contract. Final field names and error payloads require route/schema review.

### Reads

- Keep person/student/account information separate from an `enrollments` collection with stable enrollment IDs and inspectable versioned terms.
- Define lifecycle eligibility explicitly before invoking `/Users/brunowong/pulse/lib/academy-domain.ts` selection; the helper does not decide whether archived/ended/future enrollments qualify.
- Zero eligible enrollments: return an empty collection and no invented lesson context. One: allow a documented legacy projection. Multiple: require selection for enrollment-specific fields; return a selection-required state rather than an arbitrary first row.
- Person-only views must continue to work without selecting a lesson. Staff-as-learner and non-student booking behavior must be covered separately.
- Do not treat schedule-intent labels as booked occurrences or accepted payment terms as paid status.

### Writes

1. Authenticate the actor and authorize the requested tenant and operation. Verify context membership and writeability using the approved isolation model; an arbitrary context ID is not authorization.
2. Parse the entire request and classify person, student, account and enrollment fields. Do not allow unknown fields or enrollment-looking custom fields to bypass enrollment selection.
3. Resolve person → student → enrollment ownership in scope. For an enrollment mutation: an explicit ID must match an eligible row; omitted ID works only with exactly one eligible row. Zero is not implicit enrollment creation. Multiple is a selection conflict. Person-only edits do not require enrollment selection.
4. Validate instructor ownership/reference, responsibility rules and all term inputs before writing. Preserve distinct person IDs and instructor-role IDs; do not guess which belongs in the hosted FK.
5. In a single database transaction, recheck ownership/lifecycle/current revision, perform allowed field changes, close any previous term range, append immutable accepted terms, and write audit/provenance. Abort every field change if any child write fails.
6. Return the committed revision and selected enrollment; report conflicts without retrying against another enrollment. UI must not display success on a rejected request.

**Proposed response categories:** malformed input → 400; unauthenticated → 401; unauthorized context/operation → 403; inaccessible/missing target → non-disclosing 404 according to existing authorization policy; ambiguous selection or stale revision → 409. Do not reveal candidate IDs or foreign-tenant existence to unauthorized callers.

The pure `expectedVersion` check is not a database concurrency guarantee. Two simultaneous commands with the same expected revision must produce at most one commit. Specify and test the lock/compare-and-swap strategy against the chosen database before integration.

## 4. Import acceptance unit and quarantine

- Approve source-system/student/subscription ID normalization first. Preserve opaque IDs, approved run provenance and original source row locations without committing customer exports.
- Preview the complete normalized run for duplicates, including duplicates split across transport batches. Persisted identity uniqueness must also protect concurrent runs.
- A creation candidate is not an accepted enrollment. Matched identity does not prove unchanged terms. Missing rows never imply deletion.
- Choose and document transaction granularity: proposed unit is one accepted subscription plus its mappings, terms and audit. If shared person/account creation is included, its rollback and reuse rules must be explicit. Whole-run atomicity is not implied.
- Quarantined rows cause no accepted-domain writes. Store their review status/provenance under the same authorization/isolation policy; corrections require a new traceable attempt, not silently relabeling old failures.
- Report accepted, rejected/quarantined and failed units separately. Record run completeness only after every unit has a durable outcome; do not repurpose the legacy sync timestamp as proof of reconciliation.
- Repeat execution must demonstrate stable persisted IDs and no duplicate terms/audit application, not merely equal pure-preview output.
- Preserve date-only legacy attendance as ambiguous evidence. Do not create an authoritative session ledger without source session IDs and an approved transformation.

## 5. Evidence required before exact migration/backfill SQL

| Gate | Required evidence | What remains blocked |
|---|---|---|
| Actual database baseline | Approved schema-only inventory: tables/columns/defaults/nullability; PK/FK/unique/check constraints; indexes; applied migration history; triggers/functions; RLS policies and grants | Exact additive SQL, real instructor FK and constraint-safe backfill |
| Isolation architecture | Approved baseline/scenario identity, ownership, immutability, refresh/rebase/conflict and promotion rules | Scope columns, keys, authorization and live-write separation |
| Source contract | Reviewed export headers and stable student/subscription/session IDs; coverage, corrections/deletions and run identity | Field adapters, ownership mapping, idempotency/backfill decisions |
| Compatibility | Decision on canonical lesson columns versus custom fields; actual account/instructor structures; CRM/funding/access consumers | Removal of single-enrollment assumptions without regressions |
| Disposable rehearsal and recovery | Explicit isolated target, synthetic auth actors, migration rollback/restore plan and tested outbound denial | DB/RLS/route/UI acceptance and any real-data shadow approval |

Do not infer the hosted baseline from historical numbered SQL files or execute all migrations as a bootstrap. Do not copy customer rows, credentials or private exports into Git. No hosted inventory is performed or authorized by this document.

The initial metadata collection handoff and locally tested read-only query are documented in `/Users/brunowong/pulse/docs/odeon-m1-schema-inventory.md`. This intentionally omits executable expressions and applied migration rows; it starts the evidence review but does not satisfy the complete baseline/authorization gate.

Once evidence exists, produce a separate executable specification containing exact object/constraint names, additive expand steps, deterministic bounded backfill, ambiguity quarantine, reconciliation counts, dual-read/write compatibility window, cutover gates and rollback/restore instructions. Do not invent missing values merely to satisfy new non-null constraints. Retain old IDs and funding/access links; any retirement of old columns must be a separately reviewed later step.

## 6. Rehearsal sequence and exit evidence

1. Review the evidence gates above; approve the exact migration/backfill and disposable target. Keep current live endpoints unchanged until then.
2. Rehearse additive migration and rollback/restore with synthetic records. Verify FK ownership, source uniqueness, non-overlapping terms and concurrent revision conflicts at the database boundary.
3. Integrate selected-enrollment reads and atomic commands only in isolation. Exercise browser and privileged-route authorization; service-role queries must enforce scope explicitly.
4. Exercise import duplicates across batches and runs, injected child failures, quarantine correction, truthful counts and absence-of-row behavior.
5. Update detail and bulk-edit callers; test zero/one/multiple enrollment states, selected-row edits, HTTP conflict display and preserved input. Verify CRM, staff, opt-out, account and funded-case behavior.
6. Attempt sends, payment collection, live calendar writes, callbacks and job execution: each must fail closed. Missing local credentials alone are not evidence.

Required acceptance links: M1-05/06/07 (selection), M1-08 (instructor mapping), M1-10/15 (terms/concurrency), M1-16/17/18/19 (import), M1-21/22 (regression), M1-23/24/25 (authorization/isolation/no-side-effects), in `/Users/brunowong/pulse/docs/odeon-m1-acceptance-plan.md`. The remaining cases still apply; this list does not waive them.

## 7. Local check command

From `/Users/brunowong/pulse`, run `npm run test:academy`. It executes the pure academy suites, fictional rehearsal tests and existing synthetic tenant-selection regression suite. Run `npm run rehearse:academy` for the narrated fictional journey documented in `/Users/brunowong/pulse/docs/odeon-m1-rehearsal.md`. These checks do not run a migration or verify hosted schema, RLS, database atomicity, browser behavior, recovery or no-send safety.

M1 remains incomplete until the relevant integration evidence is recorded. More passing pure tests do not remove the gates above.

Validation for this specification: `npm run test:academy` passed **130 tests**, zero failed/skipped. TypeScript, targeted academy ESLint and `git diff --check` passed. Referenced absolute file paths and explicit acceptance IDs were checked. No new domain behavior, hosted inspection or integrated acceptance evidence was added in this documentation/tooling pass.