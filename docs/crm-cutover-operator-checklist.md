# CRM consolidation operator checklist — preparation only

Not authorization to change production. Status: local database transfer, replay,
and callback abort tests exist; hosted application and writer coordination gates
are still open. No maintenance window has started.

## Scope

Move only crm_contacts, lead_intakes, lead_events and job_applications into main.
Keep existing main tenants, accounts, Auth identities and staff login unchanged.
Do not merge people/contact identities, delete source records or redesign Leads.
Private snapshots contain PII: never put them in Git, chat or command output.

## Before scheduling

### Hosted query-shape checker (prepared, not executed against Supabase)

`scripts/crm-consolidation/check-hosted-api.cjs` supports explicitly authorized
zero-row GET requests for all four CRM tables, including contact embeddings.
It requires private environment variables `ODEON_API_CHECK_PROJECT_REF`,
`ODEON_API_CHECK_URL`, `ODEON_API_CHECK_SERVICE_KEY`, and
`ODEON_API_CHECK_AUTHORIZE=read-only:<project-ref>`. Never paste keys into chat,
commit them, or put them in command arguments. Authorization must name the project
actually being checked. The checker refuses redirects and mismatched URLs and
never prints upstream response bodies. It does not read dotenv files automatically.

Run only after separate approval for that project's read-only API access:
`node /Users/brunowong/pulse/scripts/crm-consolidation/check-hosted-api.cjs`.
Checking the destination requires the tables to exist there; this tool neither
creates them nor authorizes their installation. A pass confirms accepted query
shapes, not real-row relationships, restricted RPC permissions, RLS isolation,
browser behavior or deployment fencing. Those acceptance gates remain open.

- [ ] Identify exact reviewed deployment revisions for both repositories. Current
  working trees include unrelated edits; do not deploy all changes implicitly.
- [ ] Refresh database definitions and private backups; verify destination is still
  appropriate and source/destination project references match the plan.
- [ ] Verify PostgREST contact embeddings and restricted queue/replay RPCs through
  the intended API. Direct PostgreSQL and mocked HTTP tests are not substitutes.
- [ ] Verify signature URLs/number configuration for the callback handlers.
- [ ] Specify how manual edits, imports, sends, calls, demos and scripts stop, and
  how already-running work is accounted for. Source barrier rejects writes but
  does not prevent external provider side effects initiated beforehand.
- [ ] Verify no old deployment bypasses capture or writes directly to destination.
- [ ] Define a final synchronization protocol for capture arrivals during abort.
  An empty queue observation is not a fence. Do not assume environment-variable
  changes update existing deployments or in-flight requests.
- [ ] Unresolved history must have a reviewed resolution procedure. Never delete
  a queue item to unblock later work; never weaken foreign keys to pass replay.

## Intended forward sequence (not executable approval)

1. Enable and verify durable capture on main before the source barrier. Confirm
   acceptance receipts exist for labeled test submissions; email is only a backup.
2. Stop initiating other CRM writes/provider actions; wait for in-flight work using
   the reviewed coordination procedure. Install source barrier and verify reads.
3. Take a final consistent source snapshot; import into empty destination tables
   without user triggers; reconcile every typed record before installing triggers.
4. Validate destination schema/grants and API behavior. Change CRM URL and matching
   server key together on the reviewed deployment, never just one variable.
5. Drain oldest captured items using one replay call at a time. Stop on blocked,
   timeout or error. Retain queue records and snapshots; reconcile privately.
6. Validate staff workflows, website delivery and callbacks. Reopen normal writes
   only after approved coordination and acceptance. Source remains protected.

## Abort boundaries

- Source data and destination data diverge once replay or normal writes occur.
  Simply reversing the environment URL can lose new history/edits.
- Local rehearsal projects captured activity on main and reverse-synchronizes the
  four CRM tables against an unchanged source baseline. Rollback preserves the
  source ALWAYS barrier until deliberately removed. It does not restore main
  messages/consent or queue markers; these stay on main and must be reconciled.
- Arrival coordination must be proven before the final reverse snapshot. If
  captures continue arriving, keep capture and source protection active rather
  than declare the old path safe. Unresolved replay blocks this abort strategy.
- A changed source baseline causes refusal: inspect/reconcile, never bypass checks.

## Retirement

Keep source available and protected while validating real usage and old consumers.
Retain independent private backups. Owner approves pausing/deleting separately;
creating hosted staging comes after retirement, not before safe consolidation.

## Local checks

Run from `/Users/brunowong/pulse`:

```sh
node scripts/crm-consolidation/rehearse-cutover.cjs
node scripts/crm-consolidation/rehearse-transfer.cjs
node --test scripts/crm-consolidation/rollback-plan.test.cjs scripts/crm-consolidation/private-artifacts.test.cjs
```

These use disposable synthetic Docker databases, not live project connections.