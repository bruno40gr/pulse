# Flexible advance invoicing — preview and production handoff

## Delivery boundary

Implemented in the existing Billing experience, using shared controls and tokens.
All mutations remain local preview state. No migration, hosted function, invoice
sender, payment provider or billing scheduler has been deployed or enabled.
Reloading the existing preview resets its in-memory financial state. Separate
browser tabs are NOT coordinated. This is not production duplicate protection.

### Retained / changed / removed

- Retained account/student/payer fixtures, invoice snapshots, PDF download, shared
  confirmation, and the 1.5-second issue hold.
- Changed invoice assembly to account scope, with student attribution on every
  line. Default payer and recipient metadata are derived from account/history.
- The simple composer exposes a whole-month count (1–24) upfront, subscriptions, visible billing details, and “This invoice only” versus “Use for future invoices”. Advanced date/schedule/override domain capabilities remain for compatibility but are not composer controls.
- Account-wide preview retains student attribution, service periods and live amount due.
- Current unpaid invoices can be explicitly replaced by the longer invoice. Paid/refunded periods remain booked. The preview/review states the replacement; no silent source deletion or second collectible invoice is allowed.
- Recurring simulation retains future edits, pause/cancel, idempotent explicit generation and duplicate protection. A one-time advance invoice does not change subscription cadence.
- Added clearly labeled local partial-payment and explicit void/release controls.

## Domain boundary intended for production reuse

`lib/academy-billing.ts` has no React, fixtures, database or clock dependencies.
Its calendar-date validation, range splitting/subtraction, overlap checks,
explicit calendar-day pricing policy, schedule planning and warnings can run in
both client and server contexts. Service ranges are half-open `[start, end)`;
the UI accepts and displays inclusive end dates. Adjacent ranges do not conflict.

`quoteFlexibleInvoice` in `lib/academy-family-preview.ts` is the **preview adapter**:
it resolves account-owned subscription records, prices their uncovered segments,
and produces immutable line snapshots with student, service dates and pricing basis.
The existing preview `FamilyAction` boundary acts as a simulated repository/commit
boundary. Production must replace this adapter and commit boundary, not the period
or schedule model or UI interaction model.

The quote includes conflicts with invoice references. Any issued invoice retains
coverage independently of collection: Open (including overdue/partially paid),
Paid and Refunded block ordinary rebilling. The explicit replacement path can
transfer Open invoice lines and payment credit to a new invoice atomically; it
does not simply ignore the old invoice. A void only releases coverage when the
explicit release flag is selected; historical snapshots remain. Replaced
invoices release their active service claims to their recorded replacement, while
their original line and payment snapshots remain available.

Review reserves only eligible quoted segments for 15 minutes; Back/dismiss releases
the reservation, successful issuance consumes it, abandonment expires it. Before
Review no persisted draft exists. Closing the entire parent workspace can leave a
reservation until expiry. Active foreign reservations block overlapping quotes.
Issuance rechecks pricing/coverage against the reviewed lines. Replacement
requests also snapshot complete source invoices (including payment state),
revalidate their account, Open status and full inclusion of selected source
periods, and reject intervening payment or source changes. Review reservations
include preserved sibling lines as well as the selected advance periods. A retry key returns
the prior result for the same payload and rejects a different payload.

Schedules reference subscription IDs, never fixed invoice amounts. Every explicit
run requotes current records, skips existing coverage and inactive/cancelled/paused
subscriptions, records completed/empty runs, and is retry-safe within current local
state. Automatic is a saved simulation preference: no background timer runs. Future
schedule edits increment a revision and reset run positions; already issued lines
remain immutable and continue to suppress overlaps. The UI previews the first six
future runs; the local planner is bounded to 120 runs. Long-lived scheduling needs
an incremental persistent cursor instead of this preview bound.

## Pricing and unresolved business rules

1. The current subscription fixtures expose a monthly quantity/current rate, but
   the owner-approved private-lesson rule counts remaining teachable occurrences
   and configured closures. That authoritative future occurrence/term history is
   not available in these account preview records. Preview quantities use the
   existing configured quantity or legacy invoice history; they are NOT asserted
   to be production occurrence-based tuition. No missing quantity defaults to one.
   Monthly-rate subscriptions use quantity one.
2. Whole months are the default. Partial dates, a mid-month start, or a partial
   residual after exclusion require explicit calendar-day proration. This is a
   labeled preview policy, not an adopted school policy. Production must supply
   an approved policy version and effective-dated price/occurrence source. Day
   proration rounds each segment to minor units; residual penny allocation needs
   approval before financial cutover.
3. Preview currently supports active USD monthly subscriptions. Nonmonthly,
   one-off lesson, other currency and unsupported lifecycle states are not silently
   converted. Supporting their cadence/price adapters is a production dependency.
4. A free-text institution recipient does not create a payer/funding authorization.
   Payers come from current account records; no synthetic institution catalog was
   added. Production must validate student-payer coverage caps, authorization dates,
   institutional permissions, sibling consolidation and funding-case linkage.
5. Voiding wholly unpaid invoices requires a reason and explicit retain/release.
   Paid/partially paid voiding is rejected. Refunds retain coverage. Production
   needs approved credit/reissue/allocation and refund/replacement policies.
6. Pausing/cancelling currently excludes future generation; historical effective
   lifecycle boundaries and mid-period repricing need a versioned terms adapter.
   The preview does not invent missing historical terms or modify issued lines.
7. Overlap warnings are intentional: e.g. six months of coverage generated every
   three months will omit previously billed dates. Gaps are flagged, not filled.
   The first manually issued invoice is independent of future schedule starts;
   overlapping scheduled runs are harmless but may be empty.
8. Payment terms default to the existing prototype’s 30 days because no structured
   account default is present. This is editable, not an inferred institution rule.

## Production integration dependencies

Repository evidence: production funding invoices are case-level totals and manual
workflow statuses (`app/api/funding/cases/[id]/invoices/route.ts` and historical
Migration 018). They do not define subscription-level financial coverage. Existing
M0/M1 docs keep live subscription billing in the operational source until cutover.
Two read-only staging schema attempts on November 8, 2026 timed out (HTTP 544).
No customer records, production schema queries or writes were performed.

Before creating an executable migration, inspect complete staging definitions,
indexes, grants, RLS policies, tenant membership permissions, migration history,
account/student/enrollment/payer FKs, and canonical enrollment-to-subscription and
funding-case relationships. Historical SQL is not proof of deployed schema.

### Additive migration plan (not deployed)

The review-only SQL companion is intentionally outside `supabase/migrations` and
ends in `.sql.review`. It is a constraint sketch, NOT an installable migration.
Do not promote it without resolving the ownership/FK and policy gates below.

1. **Canonical mappings and terms:** reuse existing tenant/account/student/payer/
   enrollment identities. Establish tenant-composite keys and versioned accepted
   terms/occurrences. Do not introduce a parallel people or subscription system.
2. **Invoice header:** extend the eventual canonical financial invoice header or
   adopt a reviewed existing table, rather than recreating `funding_invoices`.
   Store currency, issued/due dates, collection state and frozen recipient/terms.
   Case workflow remains separate and links through invoice allocations.
3. **Charge ledger:** immutable student/subscription/date-range/quantity/rate/amount,
   pricing-policy/term version and invoice-line relationship. Credits/adjustments
   are explicit linked entries, not edits/deletions of issued charges.
4. **Coverage claims:** claims keyed by tenant + canonical subscription + actual
   range, with reserved/issued/retained/released states. An active-range exclusion
   constraint is independent of collection/payment status. Draft claims use expiry
   and an owning draft; issued claims reference the financial invoice/charge.
5. **Arrangements/runs:** account/payer, selected subscriptions, schedule version,
   independent cadence/coverage/timing/terms, timezone, start/end/count, status,
   next-run cursor, generated invoice and deterministic run key. Custom rows keep
   explicit dates and subscription selections; edits create a new version.
6. **Idempotency/audit:** unique tenant + operation key, canonical server-computed
   request hash, committed result and actor. Record source (manual/normal cycle/
   arrangement), transitions and explicit release/replacement reasons.

### Single server-side issue transaction

Use an authenticated tenant-scoped route and one database RPC/transaction for ALL
invoice creation paths, including the normal monthly cycle and funding/manual jobs.

1. Resolve actor/permissions/tenant server-side. Validate account membership, payer
   authority and terms; never trust prices or claim status from the browser.
2. Lock the idempotency operation and selected canonical subscriptions in stable
   order. Verify existing request hashes; return the committed result on retry.
3. Release expired draft claims **inside this transaction** under the same locks.
   Do not use `now()` in a partial-index predicate; expiry is a state transition.
4. Load effective terms, lifecycle/closure/occurrences and existing claims. Compute
   and subtract coverage for each subscription independently. Reject empty output.
5. Compare the reviewed pricing/coverage version. If changed, return HTTP 409 with
   references and a fresh quote; never silently issue a different reviewed total.
6. Insert frozen invoice/charge lines, consume owned draft claims, insert issued
   claims, record the operation/run result and an outbox event atomically. The
   exclusion constraint is the final concurrency guard, not UI checks or locks alone.
7. Deliver documents or invoke providers only from an idempotent outbox worker
   after commit. Do not hold database locks during external calls.

PostgreSQL supports range exclusion with `btree_gist` and transaction-scoped locks;
the constraint and locking designs must be validated against staging PostgreSQL 17.
Reference: PostgreSQL documentation, Range Types §8.17 and Explicit Locking §13.3.
These are design choices, not claims that this deployment already enforces them.

Draft reservation/renew/release and explicit void/replacement must use the same
subscription locks and constraints. Payment webhooks alter settlement/allocation
only, never claims. Refunds do not release history. Normal billing resumes by
finding unclaimed service periods, not by mutating subscription cadence.

### Required staging/release tests

- Migrate an isolated synthetic tenant; verify RLS and tenant-composite FKs.
- Reconcile historical invoices to actual service periods. The preview’s fallback
  to due month is legacy compatibility, not a safe production backfill rule.
- Quarantine ambiguous/overlapping legacy coverage for review; never rewrite it.
- Two independent database sessions: overlapping manual/manual, manual/job and
  job/job finalizations; assert only one active claim and no orphan invoice.
- Same and different idempotency payloads; crashed/retried jobs and outbox delivery.
- Draft expiry/renewal/finalization races and clock/timezone/month-end boundaries.
- All payment states; void retain/release, replacements, credit/refund allocation.
- Effective prices, closures, starts/pauses/cancellations, backdated terms, sibling
  scopes, funding caps, custom gaps and schedule edits without historical mutation.
- Rehearse rollout/backfill/rollback with collection disabled. Enable no live job
  until every existing invoice creation path adopts the common transaction.

## Local verification

`npm run test:academy` includes `scripts/academy/flexible-billing.test.cjs`.
Browser coverage lives in `scripts/security/flexible-billing-browser.cjs` and uses
the existing local harness on port 3197 at desktop/mobile widths. Network routes
are restricted to localhost and API responses are intercepted.
The old month-list and combine-menu browser entry points forward to this replacement
workflow suite. Legacy combine domain tests remain in `family-preview.test.cjs`;
the removed combine-menu interactions are intentionally retired. See the task’s
final response for actual run results.

## Focused Create invoice composer

The invoice entry action, task heading and final confirmation use **Create invoice**. This remains the existing review/reserve/create transaction; it does not introduce a saved-draft feature or change the ledger action names.

The standard contact reference drawer is capped at 960px. Invoice composition uses the established wider task drawer (up to 1160px), already used by V3; regular contact tasks retain their existing widths. At 880px of actual composer width, configuration and a sticky live preview sit side by side. Below that, they stack. The breakpoint is container-based, not viewport-based.

`planInvoiceComposition` distinguishes unpaid current-month invoices from settled months. For example, on November 10, 2026, an Open November invoice becomes part of a November 2026–January 2027 replacement when three months are selected. If November is Paid, the new period is December 2026–February 2027. The date of creation does not prorate an already-billed full November month. Open multi-month advance invoices outside the current-month replacement rule remain booked; the composer advances past them rather than rewriting an existing arrangement.

Replacement uses explicit `replacementInvoiceIds` and `expectedReplacement` fields on the existing flexible-invoice path. Original source lines retain their exact amounts, dates and pricing snapshots; only additional months are newly priced. All unselected sibling lines from a shared source invoice are carried unchanged. Sources become Replaced with a replacement reference only upon successful creation; review/back do not change them. Partial payment credits are summed onto the new invoice, original payment snapshots remain on noncollectible source records, and amount due equals new charges minus transferred credit. Source snapshots prevent a payment made during review from being lost. Retries return the original result. Fully settled sources cannot be replaced by this path. No automatic refund or paid-invoice void/reissue is introduced.

The user still enters a whole-month count (1–24) and “This invoice only” versus “Use for future invoices”; every composer control is visible. There are no history/overlap controls, per-subscription overrides, custom date ranges or advanced schedule controls here. Dates are calculated, not configurable.

Payment defaults to upfront. Full months use the existing monthly pricing basis; the composer never prorates for a mid-month subscription start. It selects whole calendar months and explicitly uses `fullBillingMonths` with whole-month pricing. Future subscriptions start at the first of their start month. Legacy explicit partial-date pricing remains available only outside this composer. Missing pricing configuration still fails safely rather than guessing. Future-invoice arrangements use matching billing duration and cadence, no advance offset, automatic-mode configuration, and dates derived from the current invoice. One-time invoices do not change arrangements or subscription cadence. Local automatic-mode configuration still does not run a background job. Legacy flexible date/schedule/override logic and its domain tests remain supported outside the simplified composer.

The local-preview indicator remains in the preview header. Pricing-policy, in-memory state, concurrency, scheduling and production-integration limitations remain documented here rather than in primary-workflow banners. No production connection, scheduler, migration, pricing algorithm or authorization rule was changed by this UX refinement.


### Production replacement handoff

In addition to the existing issue transaction, lock every source invoice, its payment allocations, service claims and applicable reservations in deterministic order. Revalidate the reviewed source versions, unpaid balance, payer authority and complete source-line disposition. Preserve source financial history; supersede the original collectible balance, transfer/reallocate partial-payment credit with an append-only audit record, move active claims to the replacement, and create its outbox delivery in that same transaction. Do not delete payment rows or recognize both original and transferred credit in balance reporting. A sibling line must either be carried unchanged or explicitly split by a reviewed allocation policy—never silently dropped. Race tests must cover payment-versus-replacement, two replacements of one source, reservation expiry, retry, rollback and outbox failures. The local `paidMinor` transfer is a simulation, not a production allocation ledger. No migration or live procedure has been enabled.


### Invoice presentation
Review uses the same shared `InvoiceDocument` as issued invoice detail, including the existing academy logo, metadata, line-item table and totals. The composer does not display replacement explanation text or automatic partial-month notices. Source links and immutable replaced records remain internal ledger/audit state, but all staff/student/parent invoice-list views exclude Replaced records. Visible invoices sort by issue date descending, with later-created records first when dates tie; filtering never mutates ledger order. New invoices use the existing monthly pricing basis without invented amounts. One-time and future-invoice whole-month preferences use the same pricing flag.


Composer refinements: the task heading includes the draft invoice reference immediately; that same reference and retry key are shared by the heading, review and issued invoice. Duration is a required numeric month-count field (1–24, including 2 months), not a preset dropdown. The live summary keeps one divider above Amount due, without a second border under the last charge. Invoice references remain local-preview DEMO references, not production-issued sequence numbers.
