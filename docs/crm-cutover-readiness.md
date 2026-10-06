# CRM cutover readiness — October 5, 2026

## Current execution sequence

Use `/Users/brunowong/pulse/docs/crm-next-actions.md` for the minimum remaining
path. The sections below retain historical evidence and limitations; they are not
a request to build additional frameworks or repeat completed preparation.

## Latest local callback evidence (supersedes historical integration notes below)

### Read-only hosted API checker — prepared locally

- Added `check-hosted-api.cjs` with explicit per-project authorization, exact HTTPS
  URL matching, zero-row GET queries, redirect refusal and sanitized failures.
- Simulated tests cover all four table queries, contact embeddings, configuration
  refusal before networking, upstream failure handling and unexpected row refusal.
- No hosted API call was made. Actual source/destination API compatibility and
  restricted RPC checks remain unverified; see the operator checklist.

### Validation refresh — October 5, 2026

- Combined cutover rehearsal passed source freeze/import/drain, replay-lock
  contention with bounded timeout and retry, and both pre-switch/post-switch
  aborts carrying SMS and voice history without undoing main consent.
- Selected callback, call-start, intake-capture, private-artifact and rollback
  Node tests: 35 passed, zero failed. TypeScript and `git diff --check` passed.
- Runs use isolated local Docker fixtures and synthetic requests. No production
  connection, deployment, configuration change or activity freeze was performed.
- This is not permission to cut over: hosted API validation and deployment/request
  fencing remain required. Lock contention coverage is not an arrival fence.

### Combined callback abort and worker contention — local evidence

- Extended `rehearse-cutover.cjs` to include main people/messages fixture tables,
  captured STOP/START and sequenced voice completion in both abort branches.
  Post-switch reverse reconciliation preserved inbound CRM history and call status
  without undoing main consent or duplicating an already persisted message.
  Pre-switch abort projected captured inquiry/SMS/voice on main and returned the
  four CRM tables to source with record equality. Queue remains on main.
- Added a separate session holding the drain advisory lock. A competing drain with
  bounded lock timeout must fail without creating a lead or completing capture;
  retry after release must complete exactly once. This exercises lock contention,
  not a throughput/load test or proof against every concurrency interleaving.
- Remaining production gates are concrete: deploy only reviewed changes; verify
  hosted API relationship/RPC behavior; establish request/capture coordination
  across old and new deployments; handle unresolved captures; demonstrate final
  abort synchronization under arrivals before reopening the old source.
- No live activity freeze has begun. These are synthetic local tests. Database-only
  callback abort coverage supersedes the earlier missing SMS/voice-branch note;
  deployment fencing and API/browser verification remain open.

### Combined database cutover/abort rehearsal — local, not deployed

- `scripts/crm-consolidation/rehearse-cutover.cjs` runs two isolated fixture
  databases in a disposable, network-disabled PostgreSQL container. No environment
  files, URLs, actual backups or customer records are accepted.
- Passed the combined sequence: source write barrier, main-database capture during
  freeze, final source export, fully reconciled import, trigger installation, and
  ordered inquiry drain. Repeating a captured delivery produced one inquiry/event.
- Passed reverse reconciliation after destination edits and with an undrained
  inquiry: drain on main, guarded reverse sync into source, retain the source
  barrier, then explicitly reopen source. Pre-switch abort follows the same local
  projection/reverse-sync approach and preserved the captured inquiry.
- Found and repaired a tool mismatch: rollback previously rejected the ENABLE
  ALWAYS source barrier. It now accepts that named barrier/function combination,
  disables it only inside the locked replacement transaction, and restores its
  ALWAYS state before commit. Other unexpected trigger states remain refused.
  Replica-mode writes were rejected after reverse sync; ordinary writes succeeded
  only after explicit barrier removal. Full existing transfer rehearsal still passed.
- This is sequential database evidence, NOT a live cutover controller or API test.
  The abort procedure still needs a proven capture-writer fence/arrival watermark
  before its final snapshot: an empty queue observed once is not proof that no new
  callback is arriving. SMS/voice abort branches, hosted API/browser compatibility,
  reviewed deployment scope and executable operational instructions remain gates.
- Do not reopen old-source normal writes while destination/capture writers remain
  active without a reconciled coordination plan. Do not treat rollback of the four
  CRM tables as rollback of main messages/consent effects or queue completion.
- No live connections, settings changes, deployment, project pause or deletion.

### Website transport keys and ordered drain — local, not deployed

- Headliner website `src/lib/formDelivery.js` now attaches an Idempotency-Key to
  intake requests. Reusing the same unchanged payload object retains the key;
  a new object or edited payload receives a new key. No PII-derived keys, automatic
  retries, persistent browser storage, or UI changes were added. Existing form
  handlers recreate payloads on submit: a manual resubmission is still a distinct
  request. This is transport-retry protection, not deduplication across page reloads.
- Website proxy forwards validated keys and now uses the stable
  `https://app.headlinerma.com/api/intake`, replacing the removed deployment fallback.
  Shadow email behavior remains unchanged. Normal legacy backend intake does not
  yet deduplicate keys, so automatic retries must remain disabled.
- `09-drain-queue.sql` supplies a backend-only, invoker RPC processing one oldest
  pending item per call. It dispatches inquiry/SMS/voice replay under the existing
  ordering lock. SMS persistence and history replay share a subtransaction. A
  failure rolls back that attempt and returns only queue ID, kind and a fixed
  reconciliation reason, never payload/error details. The item remains pending;
  later items are not silently skipped. Previously persisted SMS effects stay intact.
- Operators must stop on `blocked`, investigate privately and fix the prerequisite
  before retrying. Do not delete/complete a blocked record merely to drain later ones.
  No quarantine bypass, queue purge, scheduled worker or live drain was introduced.
- Local website tests and synthetic Docker drain tests passed, including refusal
  to skip unresolved voice history and rollback of partial unmatched-SMS effects.
  Hosted RPC permissions, deployment compatibility, concurrent lock behavior under
  real traffic and operational cutover/abort execution remain unverified.
- Both repositories contain local changes only; no live project/settings changed.

### Website intake capture — local, not deployed

- `/api/intake` uses the same explicit `ODEON_CRM_CALLBACK_MODE=capture` switch
  as callback handling. After normal validation it captures normalized inquiry or
  application data into the main queue and returns HTTP 202 with `queued: true`
  and `receipt_id`. It does not create a CRM record until replay. Default legacy
  behavior remains immediate CRM insertion; no environment settings changed.
- Capture is pinned to CRM_TENANT_ID (existing Headliner default if unset), rejecting
  a different client tenant. This is not authentication: the endpoint remains public.
  Existing reflected CORS, abuse limits and legacy contact-overwrite behavior remain
  separate unresolved security work; capture is not a complete intake hardening fix.
- Optional `Idempotency-Key` is accepted and permitted by CORS. A capture conflict or
  storage failure returns generic 503 without CRM fallback. Existing website clients
  do not send keys; those requests receive distinct random capture keys. Automatic
  retry deduplication therefore requires a website change or reviewed reconciliation.
  Never deduplicate automatically using matching name/email/phone alone.
- Phone-only applications and array normalization match replay expectations. Inquiry
  source and tracking metadata are retained. Catch responses/logs no longer expose
  raw database errors or submission payloads.
- Website submitToCrmIntake accepts any HTTP success response, including 202. This was
  established by code inspection, not a deployed-browser test. In shadow mode email
  succeeds independently of CRM delivery; queued inquiries will not appear until drain.
- 103 synthetic intake/callback/call/tenant tests passed; TypeScript, targeted intake
  lint and diff checks passed. Live API compatibility, website retry keys, operational
  drain/quarantine/retention and source-abort handling remain required before cutover.

### Call boundary update — local, not deployed

- Middleware now bypasses session authentication for the exact `/api/calls/status`
  path. The handler still requires a valid Twilio signature, configured sending
  number/account, valid status and sequence. Call initiation remains session-gated.
- Call initiation validates tenant-owned inquiry/contact IDs before provider effects,
  derives the CRM contact from the inquiry, and writes history to the configured
  CRM client. No people ID is inserted into a CRM-contact foreign key. Non-inquiry
  calls can still use people or CRM contact IDs but do not create inquiry history.
- Capture mode refuses new calls before any provider side effects. This does NOT
  freeze manual edits, campaigns, intake or demo fixtures; those gates remain open.
- Legacy callback history now uses the configured CRM client, matching call-start
  writes. Capture continues to use the main queue. Legacy updates are not atomic
  or sequence-guarded; ordered SQL replay is available only in capture mode.
- Call creation requests only the provider's `completed` callback event; no callback
  is requested without an inquiry to link. The callback URL uses PULSE_APP_URL when
  configured, matching signature verification. Actual Twilio delivery remains untested.
- Failed history persistence after provider call creation returns the call SID with
  `historyRecorded: false`, rather than inviting duplicate creation through an error
  retry. This is NOT durable recovery. Current UI callers do not display this flag;
  reconciliation/warning handling and call-start/callback races remain open gates.
- 96 synthetic call/SMS/tenant tests passed. TypeScript, targeted application lint,
  and diff checks passed. No network/provider calls or production changes occurred.

- SMS and voice handlers include explicit opt-in `ODEON_CRM_CALLBACK_MODE=capture`.
  Signed callbacks capture into the main database; SMS also invokes atomic main
  message/consent persistence. Capture failures never fall back to old CRM writes.
  Default remains legacy; no configuration or deployment has been changed here.
- `08-replay-voice-status.sql` adds atomic voice projection/completion. It requires
  one tenant-owned call_started event, preserves existing payload fields, uses
  provider sequence to prevent stale status regression, and leaves unresolved
  callbacks pending. Database tests cover retries, older sequences, invalid
  status, foreign tenant, unresolved calls, ordering and browser-role denial.
- Synthetic HTTP tests cover real Twilio signature calculation with fake tokens,
  capture contents and failure responses. They are handler tests, not hosted API
  or middleware end-to-end tests.
- Remaining gates: durable recovery of call-start history failures and races;
  website retry deduplication and hosted intake verification; queue
  drain/quarantine/retention and source-abort strategy; hosted API/browser checks.
  Global queue ordering intentionally blocks behind unresolved earlier records:
  an operator resolution procedure is still needed. SQL alone is not a worker.
- No production connection, database change, deployment or real messaging occurred.

## Decision: not approved for live cutover

Actual CRM records transferred into a restored main public/auth database locally with complete equality; all 42 existing main public tables remained unchanged. Local restores excluded original ownership/ACLs and did not reproduce hosted services. Production remains untouched by the rehearsals.

## Compatibility evidence

- `lib/supabase/crm-admin.ts:3-6` selects the connection using CRM URL and matching service-role key. Do not change one without the other. Keep these variables until the switch is accepted; retiring the separate project does not require immediately renaming this module.
- Inspected CRM consumers: intake, leads list/detail/import, inbox, campaign sending, inbound SMS, demo fixtures. Repository scan found no `.rpc()` or `.storage` calls in the inspected lead/intake/inbox/campaign directories. This is not an audit of unknown external consumers.
- `scripts/crm-consolidation/rehearse-transfer.cjs` checks backend list/contact joins, edit/history writes, trigger behavior, browser-role restrictions and foreign-contact rejection directly in PostgreSQL. It does not test PostgREST embedded relationships, schema cache, JWTs, deployed environment variables or browser UX.
- `app/api/calls/route.ts:26-30,86-90` writes a supplied contact ID to main lead_events. The destination FK requires crm_contacts.id. Validate the caller's ID domain before enabling lead calls; an arbitrary people ID is not valid. Insert errors are currently ignored. Do not weaken the FK to make calls appear successful.
- `app/api/calls/status/route.ts:27-47` looks up and updates events globally by call SID; signature/tenant authorization is absent in the handler. Migration makes the table available but does not fix that boundary. Callback handling must be reviewed before cutover.

## Writers and required cutover treatment

| Writer | Required treatment | Current readiness |
| --- | --- | --- |
| Website /api/intake | Account for every email/inquiry while database writes pause; shadow is not a queue | Not implemented |
| Manual lead create/edit/delete and win-back import | Disable writes and wait for in-flight operations | Not implemented |
| Campaign sending | Stop new sends; wait for active runs; account for provider events | Not implemented |
| Inbound SMS | Preserve incoming messages and replay/link CRM events without duplication; preserve STOP handling | Not implemented |
| Voice calls/status | Stop new calls; handle outstanding callbacks and invalid contact IDs | Not implemented |
| Demo fixture setup | Prevent background fixture writes during final snapshot | Not implemented |
| Maintenance scripts | No executions during the window; confirm target connections | Owner coordination required |
| Old Vercel deployments | Ensure old endpoints cannot continue writing to source | Not verified |

Do not simply return HTTP 503 to every webhook and assume provider retries will recover data. Do not rely on CORS as a write barrier. No write-pause code has been deployed or implemented by this document.

## Rollback boundary

Before any destination writes, source remains authoritative and previous connection/deployment can be restored after checking for late source writes.

After destination writes, the current empty-table import tool is NOT a rollback mechanism. Required before approval:

1. Stop both sides' writers and export both sides privately.
2. Compare against the exact accepted cutover baseline; detect additions, updates, deletions and conflicting changes on both sides.
3. Abort on conflicts instead of silently choosing a winner. Preserve main-only call events as appropriate.
4. Reconcile records transactionally with triggers handled deliberately; do not reset historical timestamps or generate duplicate events.
5. Re-export and compare complete records before reopening source writers.

`scripts/crm-consolidation/rollback-plan.cjs` now computes insert/update/delete differences in memory, requires the old source to equal the cutover baseline, validates tenant/relationship consistency, and refuses unexpected source writes. It emits a NON-executable plan, not SQL, and opens no connections. Synthetic Node tests cover changes, ordering, input immutability, conflicting source activity, duplicate IDs, column/ownership changes, and invalid relationships.

`scripts/crm-consolidation/rollback-sql.cjs` now builds a guarded reverse-reconciliation transaction. It opens no connections and supplies no live execution command. In disposable Docker PostgreSQL, replay of post-switch additions, updates and deletions passes complete-record comparison. A stale source baseline is refused under locks. Invalid destination columns roll back the whole transaction and restore original trigger state. New inquiries create history after a successful replay.

This narrowly scoped strategy replaces the contents of the four CRM tables after verifying the source baseline; it does not replace tenants or other main tables. It disables USER triggers transactionally, keeps foreign keys enabled, and deletes children before parents. Unexpected pre-existing trigger states are refused. Any new incoming foreign keys or additional user-trigger side effects require review before use. Both writer sets must remain frozen throughout snapshots and reconciliation; destination freshness is still an operator coordination requirement. Live execution, hosted permissions, and actual-data reverse rehearsal are not verified. Do not promise safe URL-flip rollback after writes resume.

### Writer handling evidence and next implementation boundary

Website `headliner-app/src/lib/formDelivery.js:120-125` waits for EmailJS then launches a separate CRM request; old browser pages retain their built delivery configuration. Changing delivery mode alone is not a reliable write freeze. Inbound SMS `app/api/twilio/webhook/route.ts:130-137` acknowledges even caught failures, so rejecting writes can silently lose CRM history without a retry. Both require tested handling before cutover; no assumption of provider retries is acceptable.

`scripts/crm-consolidation/write-barrier.cjs` now builds a transactional source barrier for INSERT/UPDATE/DELETE/TRUNCATE on the four CRM tables. It opens no connections. Local Docker tests verify service-role writes, owner truncation and replica-mode writes are refused, reads remain available, and removal restores writes without changing records. Lock acquisition times out after five seconds rather than waiting indefinitely. The ALWAYS triggers also cause the reverse replay tool to refuse execution until the barrier is removed under coordinated writer shutdown.

This barrier is NOT deployed or approved for live use. It is not a queue and does not capture failed requests. A database owner can explicitly remove/disable it; maintenance must stop. Preservation/replay of intake and inbound events is still required before activation. In-flight external sends/calls need separate draining; database locks cannot undo provider side effects. Existing source must remain active; do not pause it to simulate a write barrier.

### Capture primitive — local rehearsal only

`scripts/crm-consolidation/04-capture-queue.sql` drafts a main-database queue outside the four frozen tables. It stores restricted payloads, server receipt time, tenant, event kind and a delivery key; duplicate keys with different payloads are refused. Browser roles cannot read/write it or execute capture. Local tests verify capture while the CRM barrier is active, retry deduplication, conflicting-key refusal, atomic rollback of a synthetic replay effect plus completion marker, and exclusion of a concurrently locked row using FOR UPDATE SKIP LOCKED.

This is a storage primitive, NOT a working intake/SMS replay system. No app route uses it. Before integration: authenticate/validate SMS and callbacks before capture; validate intake and add stable retry keys to the website; never derive dedup keys solely from email/body (identical legitimate inquiries may be distinct). Capture must succeed before acknowledging delivery. Actual replay must perform CRM effects and queue completion within one transaction in the main DB, preserve receipt times deliberately, and avoid repeating STOP/START or other external effects. The separate old CRM cannot participate in that atomic replay: an abort before consolidation requires a separate reviewed drain strategy. Order related messages and bound replay batch sizes; worker skipping is not proof of ordered processing. Define retention/purge and verify backlog zero before retirement. Old deployments must be drained/protected before the barrier is enabled. None of these integration gates is satisfied by the synthetic queue test.

### Inquiry replay — implemented locally, not wired to HTTP

`05-replay-inquiry.sql` implements one inquiry replay per invoker-privilege transaction. It locks the queue row, serializes replay workers, refuses out-of-order pending intakes, and uses the queue UUID as the inquiry UUID for retry stability. Contact lookup is tenant-scoped; ambiguous matches are refused; existing identity fields are not overwritten. New contact/inquiry/creation-event timestamps preserve server receipt time. All effects and completion commit together. Local Docker tests cover failure under the barrier leaving no contact/lead effects, successful tour categorization, one event after repeated calls, unchanged matching contact, unsupported application refusal, and denied browser execution.

The same function now supports job applications with deterministic application IDs and atomic contact/application/completion. Applications accept email OR phone, matching current intake. Phone-only applications retain NULL contact email and empty application email for its existing NOT NULL column. Positions and availability must be arrays, with non-string entries filtered as in current intake. Local tests verify retry stability, preserved receipt timestamps and string arrays, absence of an accidental inquiry, and failure under the write barrier leaving no contact. The function name remains `odeon_crm_replay_inquiry` for compatibility with the existing draft and tests; it handles both intake variants.

This intentionally differs from current public intake's identity-overwrite behavior and requires acceptance before route integration. Replay payload must already contain normalized source metadata from the server; this function is not the full HTTP validator. Tests use fake records and invoker grants on plain PostgreSQL, not Supabase API. SMS, voice status, strict mixed-kind event ordering, direct-writer coordination and pre-consolidation abort drain remain unimplemented. No production route or website changed in this step. Invalid intake items deliberately block later intake replay; operator correction/quarantine needs an auditable procedure (the synthetic test's direct payload correction is not a production recovery command).

## Remaining approval gates

### Actual main-schema SMS rehearsal

`rehearse-main-sms.cjs` restores public/auth definitions only from an owner-only
local main archive into a network-disabled PostgreSQL 17 container. No customer
rows are restored. Original ownership/ACLs are excluded, with explicit local backend
grants. It checks the new queue and atomic SMS function against actual main table
constraints/triggers using synthetic people/messages. STOP then START and retry
of the old STOP pass without duplicates or consent regression; message receipt
timestamps and person links match. The container/volume is removed afterward.

The initial restore failed because schema-filtered pg_restore omitted the auth
namespace; creating that namespace before restoring its actual archived definitions
resolved it. Private diagnostics remain beside the archive and were not printed.
Final rehearsal passed. This is not full Supabase recovery, original-grant verification,
or PostgREST/browser coverage. No live database connection or deployment occurred.
HTTP durable-capture integration and voice callbacks remain open.

### SMS association compatibility update

The atomic draft now uses the latest tenant-scoped outbound message to the sender
(E.164 or US ten-digit representation) before falling back to people.phone. It
preserves that message's campaign association, validates person/campaign tenant
ownership, and excludes outbound records newer than the captured receipt time.
Ties use message ID for deterministic selection. Ambiguous fallback people are
still refused instead of choosing an arbitrary first match.

Synthetic Docker regression checks passed: an outbound match remains associated
even after the person's phone changes; the campaign is preserved; a foreign-tenant
campaign causes refusal without a message write. Full transfer rehearsal,
JavaScript syntax and diff checks passed. This uses fixture tables, not the complete
restored main schema. HTTP integration and hosted API checks remain pending.
No live connection, deployment, customer-data access or configuration change was
made for this update. This supersedes the earlier note that outbound lookup and
campaign association were absent from the atomic draft.

### Atomic main SMS/consent draft — local only

`07-persist-captured-sms.sql` adds a separate message-persistence marker to capture
and an invoker function for main messages/people effects. Message insertion,
STOP/START and the marker commit together. Queue IDs identify messages; retry
verifies the message and never reapplies an older consent command. Persistence
waits for earlier SMS items; CRM history completion remains independent.
Malformed payloads and pre-existing provider IDs require reconciliation rather
than silent adoption. No unique provider-ID constraint is added to existing messages.

The private main backup's schema shows messages.contact_id references people;
the tenant/Twilio SID index is nonunique. Only these schema definitions were read
from the existing local archive; no live connection was made. Docker tests use a
minimal compatible fixture, not the complete restored main schema. Tests cover
failed insert rollback, ordered STOP then START, retry of old STOP without consent
regression, timestamp preservation, and browser execution denial. Docker rehearsal,
12 Node tests and syntax/diff checks passed.

NOT INTEGRATED: HTTP capture and use of this function remain absent. The live-route
draft still has separate writes. Matching deliberately refuses ambiguous people;
unmatched senders store a message with null person. This differs from the current
route's latest-outbound lookup and campaign association (not yet reproduced here).
Confirm that behavior and test full restored main triggers/grants before adoption.
SMS history replay must require successful main persistence when this draft is
integrated; its current standalone tests do not enforce that prerequisite.
Global receipt ordering is not proof of provider event order. Voice callbacks,
operational drain, queue retention/quarantine and pre-cutover abort remain open.
No production database, configuration, deployment or real messaging changed.

### Inbound webhook boundary repair — local only

`app/api/twilio/webhook/route.ts` now rejects missing/invalid Twilio signatures
before domain writes. Receiving-number configuration determines tenant and token;
the hardcoded tenant default is removed. E.164 phone validation prevents filter
metacharacters. The signature URL uses PULSE_APP_URL (if set) plus the incoming
path/query; before deployment verify that this matches the actual Twilio webhook
URL, and that twilio_config has the receiving number and correct token.
Raw message/phone/error logging is removed. Lookup, consent, persistence and
history failures now return generic 503 responses rather than false success.

Synthetic route tests use the installed Twilio signature implementation with fake
tokens; they cover rejected callbacks, signed STOP/START, tenant selection and
storage/lookup failures. They do not prove provider retries or production URLs.
No deployment, live connection or database change occurred. The installed Next.js
package has no node_modules/next/dist/docs guides; this change follows the existing
status-route Request/FormData/NextResponse pattern.

IMPORTANT: this route is not yet idempotent or atomic across consent, message and
CRM history writes. A late failure can leave a stored message and a 503; retry can
duplicate that message. Do not deploy as a complete cutover fix. Durable capture,
transactional message/consent effects, retry ordering and voice integration remain
required. No cutover-mode environment flag has been enabled or added.

### SMS history rehearsal update

`06-replay-sms-history.sql` is tested locally for atomic history/completion,
receipt-time preservation, retry stability, tenant scoping and browser-role denial.
Malformed SIDs, mismatched delivery keys or tenant payloads, and ambiguous senders
are refused without history writes; unresolved senders remain pending. Inquiry
replay now waits for every earlier pending queue kind, matching SMS replay ordering.
The Docker transfer rehearsal and six Node tests passed with synthetic data only.

This is CRM history projection only. It does not persist the inbound message,
apply STOP/START, validate provider signatures, capture from HTTP, or replay voice
status. Existing webhook behavior is unchanged and not safe for cutover yet.
An unresolved older item blocks subsequent replay deliberately; a reviewed,
auditable correction/quarantine procedure is still required. No live connections,
deployment, or production configuration changes were performed for this update.

- Fresh source/destination schema and grants preflight; no conflicting namespaced functions.
- Supabase API relationship/read/write smoke tests with synthetic records; no real messages sent.
- Reviewed, tested writer coordination and capture/replay mechanism.
- Conflict-aware post-write rollback rehearsal, or an explicitly approved alternative recovery strategy.
- Final source snapshot after writers settle, complete reconciliation and recorded deployment revision.
- Owner approval for a defined window; separate acceptance before source retirement.

## Deferred

Tour-request UI visibility, contact/person identity merging, UI redesign, module renaming, and CRM project pausing/deletion. None belongs in the data-transfer rehearsal.
Phone-only compatibility regression: local Docker tests verify repeat replay creates one application, empty application email/NULL contact email are preserved, and missing both contact methods leaves the queue pending with no new contact. No production schema or route changed.
