# M1 — Synthetic acceptance plan

**Date:** October 26, 2026\
**Status:** Acceptance specification with initial pure-domain tests executed; integrated M1 acceptance remains pending.
**Design:** `/Users/brunowong/pulse/docs/odeon-m1-domain-compatibility.md`

**Later booking/benefit decisions:** `/Users/brunowong/pulse/docs/odeon-enrollment-decisions.md`. Pure booking-request transition tests add 12 passing checks (145 combined); no provider, scheduling, UI or persistence acceptance is implied. Teacher-benefit automation and full payment lifecycle remain future integration work.

**Integration specification:** `/Users/brunowong/pulse/docs/odeon-m1-integration-spec.md`. Run the current local-only academy and tenant-selection checks with `npm run test:academy` from `/Users/brunowong/pulse`; this does not certify integrated acceptance.

## 1. Test setup and boundaries

Use entirely fictional fixtures with stable explicit IDs: two tenants; an adult linked to two siblings; another adult with a different household; a pickup-only contact; an instructor who is also a learner; two concurrent enrollments for one student; two instructors; private-lesson service/plan versions; reusable offers; source mappings; one baseline and two scenarios once storage is decided.

No customer records, credentials or network calls in fixtures. Database tests use a separately verified disposable isolated target and synthetic auth actors. Do not run the existing destructive staging refresh, production verifiers or provider integration scripts to execute this plan. Unit tests alone cannot establish RLS, transactionality or no-send safety.

## 2. Required M1 cases

| ID | Scenario | Expected evidence | Test layer |
|---|---|---|---|
| M1-01 | Instructor enrolls as a learner | Same person identity; separate compatible role links; existing membership untouched | Domain + DB |
| M1-02 | Siblings share adult email; same-name students exist | No automatic person merge; ambiguous source rows quarantined | Adapter + import |
| M1-03 | Adults span households | Student-specific links preserved; neither household dictates blanket access | Domain + DB |
| M1-04 | Pickup-only adult | No billing/staff/portal permission inferred; unrelated student access denied | Auth + DB |
| M1-05 | Two concurrent enrollments, including repeated service | Stable independent IDs/terms; edit one leaves the other unchanged | API + DB |
| M1-06 | Legacy edit omits enrollment ID with two candidates | Clear ambiguity response; no person/account/enrollment partial writes | API + DB |
| M1-07 | Legacy view with zero, one, two eligible enrollments | Empty, unambiguous projection, explicit selection respectively; never array-order authority | Adapter + UI |
| M1-08 | Instructor person/role IDs disagree or cross tenant | Reject invalid mapping; no guessed staff/person FK or second staff identity | Domain + DB |
| M1-09 | Four supported plan shapes | Weekly visits independent of cadence; prepaid terms and visit packs not forced into monthly collection | Domain |
| M1-10 | Service/plan template edited | Existing accepted terms unchanged; new selection uses reviewed version | Domain + DB |
| M1-11 | Save and reuse named monetary/percentage offers | Two applications reference one tenant-scoped definition; fixed price differs from amount off | Domain + DB |
| M1-12 | Rename/edit/archive saved offer | Historical applied terms/version retained; no invisible repricing | Domain + DB |
| M1-13 | Invalid offer values/scope or unintended stacking | Validation blocks invalid calculation/application; no negative payable amount | Domain |
| M1-14 | Free/$5 visit versus period offer | Correct explicit scope; no automatic recurring enrollment or paid status; no double-counted converted visit | Domain + adapter |
| M1-15 | Effective terms overlap / stale write version | Conflict rejected atomically; existing history intact | Domain + DB |
| M1-16 | Repeat same source import, then second subscription | Idempotent first enrollment; distinct second enrollment; mappings stable | Import + DB |
| M1-17 | Missing/duplicate/conflicting source subscription ID | Preview/quarantine; no arbitrary enrollment overwrite or deletion | Import |
| M1-18 | Inject child-write failure during import/conversion | Accepted unit rolls back; counts/status reflect failure; no false sync-success | API + DB |
| M1-19 | Two attendance rows on one date without source sessions | Preserve legacy ambiguity; no invented session ledger or merged authoritative attendance | Adapter |
| M1-20 | Reviewed conversion from inquiry with multiple learners | Preserve inquiry; explicit identity/enrollment links; won not equated to paid | API + DB |
| M1-21 | Funding case already linked to account/student | References, compatibility fields and routing preserved; no invented private-pay default | Regression + DB |
| M1-22 | Staff/contact/membership/opt-out regression | No changed staff identity, unauthorized grant or automatic message | Regression |
| M1-23 | Wrong tenant/context through browser and privileged route | Read/write denied; supplied IDs do not authorize; no fallback to live | Auth + DB |
| M1-24 | Scenario edit / baseline refresh / conflicting version | Other scenario and live records untouched; conflict visible; no silent promotion | Integration after storage decision |
| M1-25 | Synthetic accepted financial terms trigger side effects | No sends, provider payments, live calendar writes or collection jobs; fail-closed attempts verified | Negative integration |

Cases requiring undecided schema/context storage are explicitly blocked until that decision; do not mark them skipped-and-passed.

## 3. Later milestone contract examples

Keep these workflow requirements visible without claiming M1 implements their engines:

| ID | Example | Later acceptance target |
|---|---|---|
| NEXT-01 | Five Thursdays, one closure, lesson rate R | Four teachable dates → 4 × R; concrete occurrences in M2, billing calculation in M4 |
| NEXT-02 | Mid-month start with three dates, one closure | 2 × R initial-month tuition; collect on enrollment, next month on the first; no date-arrived-equals-paid |
| NEXT-03 | Timely cancellation and late cancellation | Issue makeup versus normal forfeiture; staff leniency explicit |
| NEXT-04 | Teacher cancellation | Substitute or contact-family/owed-makeup workflow; next-month regular count unchanged |
| NEXT-05 | Makeup issuance/import/expiry | Six months from original issuance; import/rebooking do not reset; lesson before expiry; no-expiry policy supported |
| NEXT-06 | Grouped/cross-instrument makeup | One entitlement redeemed per participating student, no value conversion or change to regular enrollment |
| NEXT-07 | Cancel booked makeup | Timely return of same entitlement with same expiry; late normally forfeits; no duplicate or extra charge |

Exact timezone, boundary and policy exceptions remain explicit prerequisites to executable edge-case expectations, not hidden defaults.

## 4. Execution and evidence requirements

1. Review case IDs and implement fixtures alongside actual domain code; do not create mock-only tests that merely restate the proposal.
2. Run pure domain/adapter tests without network or environment credentials.
3. Rehearse additive schema/backfill/rollback against the isolated synthetic database; exercise constraints, RLS, service-role command checks, idempotency and injected failure atomicity.
4. Exercise routes/UI after installed framework-guide review; verify explicit enrollment selection and inspectable accepted terms.
5. Run the existing local-only tenant/staging synthetic suites and TypeScript checks. Inventory funding/access regressions and approve an isolated execution plan before using any script capable of hosted writes.
6. Record command, fixture/schema revision, passed/failed/blocked case IDs and limitations. M1 acceptance requires relevant domain, database and UI evidence, not a documentation keyword check.

## 5. Current validation record

The initial planning pass created the design and test specification. A subsequent implementation pass added pure helpers in `/Users/brunowong/pulse/lib/academy-domain.ts` and executable tests in `/Users/brunowong/pulse/scripts/academy/domain.test.cjs`. No integrated M1 routes/UI, migrations or financial calculations have been implemented. M0 hosted safety, source-data and storage/recovery gates remain open.

Local validation performed for this planning change:

- `git diff --check` passed.
- Referenced local paths exist; the plan contains 25 unique M1 case IDs.
- `node --test scripts/security/tenant-selection.test.cjs` passed **74 existing synthetic regression tests**, with zero failed or skipped. These tests validate existing tenant/access behavior, not implementation of the proposed M1 cases.
- No hosted verification, application build, migration, deployment or provider action was performed.

### Initial implementation validation

- `node --test scripts/academy/domain.test.cjs scripts/security/tenant-selection.test.cjs`: **96 passed** (22 new pure-domain tests + 74 existing regressions), zero failed/skipped.
- `./node_modules/.bin/tsc --noEmit --incremental false --pretty false`: passed.
- Targeted ESLint for the new helper/test files and `git diff --check`: passed.
- Partial domain evidence for M1-06/07/08/09/10/11/12/13/15/23: scoped selection, plan parsing, offer validation and snapshot/version behavior only. No whole acceptance case is certified by these tests: route atomicity, database constraints, authorization, persistence and UI remain untested M1 work.
- No provider, network, database or environment access is available to the new pure-domain test module. No live route behavior changed.

### Source-identity preview validation

- Added `/Users/brunowong/pulse/lib/academy-import-preview.ts` and `/Users/brunowong/pulse/scripts/academy/import-preview.test.cjs`: **16 new synthetic tests passed**.
- Combined execution of domain, import-preview and tenant-selection test files: **112 passed**, zero failed/skipped. TypeScript, targeted ESLint and `git diff --check` passed.
- Partial adapter-level evidence for M1-02/16/17/23: unknown student quarantine, stable subscription matching, distinct second subscription, duplicate/conflicting source identity and tenant/context/source inventory rejection. This does not certify actual import idempotency, database constraints or authorization.
- Identity-only preview returns matched, creation-candidate or quarantined rows; it never declares unchanged terms or accepted writes. Missing rows do not imply deletions. Normalized row positions are not original CSV line numbers.
- Existing CSV parser, Contacts import routes and source-data refresh remain unchanged. An approved source-ID contract and storage/schema verification are still prerequisites to integrating this adapter.

### Effective-dated terms validation

- Added `/Users/brunowong/pulse/lib/academy-enrollment-terms.ts` and `/Users/brunowong/pulse/scripts/academy/enrollment-terms.test.cjs`: **18 new synthetic tests passed**.
- Combined academy domain, import-preview, enrollment-terms and tenant-selection suites: **130 passed**, zero failed/skipped. TypeScript, targeted ESLint and `git diff --check` passed.
- Partial domain evidence for M1-10/15/23: immutable copied service/plan terms, valid calendar dates, proposed half-open effective ranges, version/date ordering, overlap rejection, scoped history and stale-version rejection.
- Proposals do not persist or authorize changes. Closing prior terms and appending the new version must be transactionally tested later; no concurrent database writes, actor authorization, offer-application attachment, live billing or historical correction workflow has been implemented or tested in this slice.

### Combined fictional rehearsal

- `/Users/brunowong/pulse/scripts/academy/rehearse.cjs` composes identity preview, enrollment selection and effective-dated terms using fixed fictional fixtures. Instructions and limits: `/Users/brunowong/pulse/docs/odeon-m1-rehearsal.md`.
- `npm run rehearse:academy` passed nine assertions. Three new tests verify the journey, fresh deterministic runs and standalone CLI execution with empty environment configuration. `npm run test:academy`: **133 passed**, zero failed/skipped; TypeScript, targeted academy ESLint and `git diff --check` passed.
- Additional composition-level evidence only for portions of M1-05/06/10/15/16/17/23. No complete case is certified: the in-memory projection does not establish database atomicity, persisted idempotency, authorization, route/UI integration or outbound safety.

### Schema-inventory tooling validation

Related relationship experiment: `/Users/brunowong/pulse/docs/odeon-m1-role-identity.md`; `npm run rehearse:academy-roles` passed eight fictional PostgreSQL checks and cleanup. Partial M1-01/08 relationship evidence only; no existing memberships, application RLS or route behavior was exercised. The existing unit/regression count remains 133, separate from these database assertions.

- `npm run rehearse:academy-schema` passed in network-isolated disposable local PostgreSQL, including metadata coverage, FK mapping, read-only execution, unchanged fixtures, repeatable output, restricted-role execution and private-literal sentinel exclusion; cleanup verified container removal.
- Handoff and limitations: `/Users/brunowong/pulse/docs/odeon-m1-schema-inventory.md`. No hosted schema was read. This is metadata-tool validation, not application migration, RLS or M1 case acceptance.
- Existing academy/tenant-selection suites remained **133 passed**, zero failed/skipped. TypeScript, targeted academy ESLint and `git diff --check` passed.