# CRM consolidation — minimum remaining path

Updated October 7, 2026. This is the current sequencing guide; older preparation
notes are evidence/history, not additional work queues. No production change is
authorized by this document.

## Goal and scope

### Current next steps — cutover already complete

The live cutover and owner acceptance are recorded in
`/Users/brunowong/pulse/docs/crm-consolidation-inventory.md`.
Do not repeat the historical freeze, export, import or connection switch below.

1. Owner verified that a recognized post-migration website submission exists in
   Odeon main (`jbrntsxmibfldocsuslt`) and is absent from the old CRM. This verifies
   that submission's routing, not the literal current write-only Vercel values or
   every external consumer. The CLI export and dashboard cannot reveal those
   secrets; masked placeholders are NOT evidence of equal configured values.
2. Local development CRM URL/key now match the local main URL/key. Main credentials
   passed a read-only query for the same post-migration record before the edit.
   A permission-restricted environment backup was saved outside Git. Local remains
   connected to PRODUCTION until staging is configured; do not run destructive tests.
3. Confirm no remaining external consumer uses the source, and retain the private
   frozen archive and recovery instructions. Recheck the capture/history queue;
   an empty queue at cutover does not guarantee it remains empty.
   Owner confirmed no other consumers use the old CRM. Both pending inbound-SMS
   history receipts were independently matched by tenant and Twilio SID to exactly
   one message each in main's inbox. No replay or queue completion was performed;
   history processing remains a main-database follow-up, not an old-CRM dependency.
4. With owner approval, pause the OLD source `xxyncvaulboqytovgfrh`, not main.
   Do not delete it to free capacity. Supabase Billing FAQ states paused projects
   do not count toward the two-active-Free-project quota.
   Owner reports old CRM paused and live app still working. This is owner-reported
   acceptance, not an independently queried Supabase project status. Next: create
   the separate staging project; do not repeat consolidation.
5. Create `odeon-staging` with separate credentials. Establish a repeatable schema
   baseline, seed synthetic data, and use only staging-scoped deployment variables.
   Disable real SMS, email, payments and production callbacks before acceptance.
6. Verify staging has no production database credentials or real customer data,
   and that tests cannot invoke live integrations. Only then use it for feature
   acceptance and database migrations.

No project pause or production configuration change was performed during this
October 7 check. Local credentials were aligned as described above. Two pending
inbound-SMS history receipts were observed in main; their presence does not imply
missing inbox delivery. External-consumer and history-resolution checks remain.
The remaining sections are historical cutover instructions, not an outstanding
task list.

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

Follow the current next steps above. The cutover is complete; do not repeat it.