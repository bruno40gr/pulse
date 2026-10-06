# CRM consolidation — minimum remaining path

Updated October 5, 2026. This is the current sequencing guide; older preparation
notes are evidence/history, not additional work queues. No production change is
authorized by this document.

## Goal and scope

Move four existing CRM tables into Odeon main, preserve records and existing
tenant identities, then retire the old CRM. No UI redesign, identity merging,
authentication migration, new infrastructure or general-purpose migration system.

## Already done — do not rebuild

- Owner supplied schemas, tenant matches, counts and relationship checks.
- Private backups obtained; actual main public/auth and CRM public archives were
  restored locally with original owners/ACLs excluded (not full hosted recovery).
- Actual-backup consolidation preserved CRM contents and all 42 existing main
  public tables in the recorded rehearsal.
- Synthetic transfer, triggers, capture/replay, callbacks, abort/reverse sync and
  replay-lock contention tested. Hosted behavior is still unverified.

Evidence: `/Users/brunowong/pulse/docs/crm-consolidation-inventory.md` and
`/Users/brunowong/pulse/docs/crm-cutover-readiness.md`.

## 1. First live gate: establish capture, do not move records yet

Agent: identify an exact reviewed deployment containing only intended changes;
do not implicitly ship the entire dirty working tree. Review the SQL prerequisites
for intake/SMS/voice capture and verify callback URL/number configuration.

Owner-approved live actions: install reviewed capture prerequisites on main,
deploy the reviewed capture-capable app, and enable capture on the intended
deployment. Keep the old CRM connection in place at this stage.

Acceptance: one labeled website submission receives a durable receipt, a private
queue check confirms it, and signed callback checks confirm their required RPCs
work. Verify restricted RPC access for browser roles. Keep EmailJS shadow mode.
Queued inquiries do not appear in Leads until replay; this must be communicated.

No-go: missing RPCs, failed persistence, incorrect signature configuration, or
old public deployments still able to bypass capture. Do not freeze CRM yet.
Stopping use of an old URL is not proof that the deployment is inaccessible.

## 2. Quiet cutover: stop edits, freeze source, copy and verify

Owner: approve a quiet window; stop lead edits, imports, sends, calls, demos and
maintenance scripts that affect CRM. Continue website/callback durable capture.

Agent/operator: account for in-flight requests and old deployments before
installing the source write barrier. Then obtain a fresh final snapshot, create
the four empty destination tables, import and reconcile every record, and install
the reviewed triggers/replay functions. Leave main tenants/Auth unchanged.

Acceptance: source is protected; destination exactly matches the final snapshot;
hosted contact joins work; existing main workflows still work. Do not use the
historical 137/137/650/0 counts as cutover counts.

No-go: barrier failure, changed schema/tenants, import/reconciliation failure,
unaccounted writers or unavailable capture. Stop rather than silently skip rows.

## 3. Switch and replay

Change Odeon's CRM URL and matching key together on the reviewed deployment.
Keep website URL and shadow delivery unchanged. Keep capture active while draining
oldest items using existing replay tooling; stop at the first unresolved item.

Acceptance: captured activity is accounted for, replay checks pass, website lead
and staff workflows work, and switching normal writes back on is coordinated with
capture arrivals. A momentarily empty queue does not prove writers have stopped.
Do not reopen normal writes until the final transition protocol is specified.

## 4. Observe, then retire

Keep old CRM protected and backups private while validating genuine submissions
and workflows. Pause/delete only after owner acceptance and confirmation that no
remaining consumer uses it. Freeing the slot and creating staging comes last.

## Failure rule

Before import: source remains the system of record; preserve captured requests.
After replay/new destination activity: never simply flip the connection back.
Use the tested guarded reverse reconciliation, with arrivals coordinated before
the final reverse snapshot. Preserve main SMS/consent and queue state. If that
coordination is not established, remain in capture and escalate; do not reopen
source under a false assumption that all arrivals have been synchronized.

## Work deliberately excluded

No additional migration framework, performance project, zero-downtime promise,
full managed-service reconstruction or recurring operator dashboard. Use existing
tools and targeted live acceptance checks. Fix only blockers found by those checks.

## Immediate next action

Review the deployment slice and capture SQL prerequisites for step 1. Execution
requires production approval/access; ordinary "continue" messages have so far
authorized local preparation, not a live SQL installation or deployment. No freeze
has begun. No more tools need to be built before reviewing this live gate.