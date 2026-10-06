# CRM consolidation: transfer rehearsal and cutover gates

## Status: preparation only (historical procedure below; see current readiness)

The owner has now exported both production backups privately. Actual-backup local rehearsals passed; no production imports, deployments or connection changes have occurred. See `/Users/brunowong/pulse/docs/crm-consolidation-inventory.md` and `/Users/brunowong/pulse/docs/crm-cutover-readiness.md` for current evidence and blockers. No live cutover is authorized by this document. Existing feature/security edits are separate from this migration and must not be incidentally deployed during cutover.

Goal: preserve four CRM tables inside Odeon's main database, keeping current workflows and tenant records unchanged. No identity merging, deduplication, UI redesign, or account/password migration is included.

## Tools prepared

- `scripts/crm-consolidation/03-export-snapshot.sql`: one read-only repeatable-read transaction exporting all fields of the four tables and tenant labels as JSON. Its output contains PII. It is a selected-table data snapshot, **not a complete database backup**. It creates no files itself.
- `scripts/crm-consolidation/transfer.cjs`: generates transactional import SQL in memory. Does not connect to databases, load environment files, or save snapshots. Import requires empty destination CRM tables without user triggers, matching source tenant labels, and exact record columns. Reconciles every typed record with bidirectional `EXCEPT ALL`; checks cross-tenant relationships before commit. Foreign keys remain enabled. No upsert, truncate, or silent skipping.
- `scripts/crm-consolidation/rehearse-transfer.cjs`: disposable local Docker runner using fake records only, no published ports and no container network. Downloads PostgreSQL 17 if necessary; removes the test container and volumes afterward. No live URL/file arguments accepted.

Run locally from `/Users/brunowong/pulse`:

```sh
node scripts/crm-consolidation/rehearse.cjs
node scripts/crm-consolidation/rehearse-transfer.cjs
```

Verified synthetic cases: Unicode, apostrophes, commas, newlines, arrays, nulls, nested JSON, UUIDs, timestamps, historical category/status overrides, complete record equality, no duplicate historical events, populated and empty applications, empty tables, post-import trigger behavior. Refusal cases: nonempty destination, tenant label mismatch, missing columns, duplicate IDs, foreign contact ID, cross-tenant relationships, active user triggers. Failed imports rolled back all inserted records.

This is direct PostgreSQL validation, not a real-data migration or a Supabase API/browser integration test. Production database versions, roles/grants/schema exposure, and fresh source definitions must be checked separately.

## Private backup/export procedure: implementation still pending

Before any live read/export:

1. Owner explicitly authorizes project-specific read-only export. Confirm source and destination by project reference, not by database name (`postgres` in both projects).
2. Select a private directory outside either repository, restrictive permissions, and encrypted storage. No cloud-synced/shared directory without an explicit data-handling decision. Keep credentials out of command arguments, logs, Git, and chat.
3. Prepare full logical backup commands for **both** projects, including relevant schema and data, and document restore scope. Decide how hosted Auth/platform-managed objects are preserved; do not assume this selected-table snapshot covers them.
4. Restore backups locally and verify recoverability. Retain originals until cutover acceptance and agreed retention. No Storage buckets were reported in CRM, but that does not waive main-project backup scope.
5. Capture a source JSON snapshot through a secure non-interactive SQL client into a permissions-restricted file, not the clipboard/chat or truncated dashboard output. Validate parsing, format, source schema, all table counts, file digest, and private file permissions. Prepare a wrapper before asking the owner to run this; it does not exist yet.
6. Rehearse the actual private snapshot locally only with owner approval. Real data in Docker volumes also needs secure handling; deletion alone is not a secure-erasure guarantee. Produce count/pass/fail summaries without PII or raw SQL/error text.

The small data snapshot is intended for the inspected CRM dataset, not a streaming large-database migration. Do not commit JSON exports, generated import SQL, database dumps, or keys. Generated import SQL contains the same PII as the snapshot.

## Cutover sequence (NOT approved to execute)

### Gate A: reviewed preparation

- Fresh definitions still match reviewed schema; main CRM tables still absent.
- Tenant IDs/names/demo flags still match; namespaced trigger function names available.
- Both backups restore; actual snapshot rehearsal passes full-record reconciliation.
- Supabase API can use backend-only grants in the test configuration; migration account has required privileges.
- Approved deployment contains only intended changes. Keep security/feature deployment decisions explicit.
- Implement and test an explicit writer pause/handling mechanism before scheduling cutover. Inventory includes intake, lead edits/imports, campaigns, inbound SMS, voice callbacks, demos, and maintenance scripts. Owner reports no other direct app consumers; unknown automations/old deployments remain a check, not a guarantee.

### Gate B: coordinated switch

1. Agree a quiet window and communicate which lead operations are unavailable.
2. Quiesce every writer that can mutate CRM. Browser shadow delivery is not a durable queue; inbound provider callbacks need defined retry/reconciliation handling. If we cannot safely quiesce or capture writes, stop and design handling first.
3. After quiescence, take the final consistent source snapshot and verify its counts/content. Do not reuse the earlier 137/137/650/0 counts as an immutable baseline.
4. Create destination schema, import the final snapshot transactionally, and reconcile full contents before installing triggers. Do not overwrite main tenants.
5. Install triggers and verify schema/grants/functions. If trigger installation fails, do not switch connections or reopen writers.
6. Change Odeon's CRM URL and its **matching** service-role key to the main project for the reviewed new deployment. Keep website `shadow` and stable `https://app.headlinerma.com` destination unchanged.
7. Confirm all running/old deployments and writers target the intended database; a Vercel environment change alone does not stop old deployments.
8. Validate login, contacts, lead listing/edit/history, inbox lookup, recipient lookup, synthetic website inquiry, and relevant callback workflows. Clearly label any test records; historical reconciliation precedes new test writes.
9. Reopen writers only after acceptance. Reconcile every inquiry/email/provider event received during the window; remove write-pause mechanisms deliberately.

### Gate C: rollback and retirement

- Before destination writes: retain source untouched; restore previous connection/deployment if the switch fails, reopen source writers, and reconcile any pending submissions. Do not delete destination/main data as a shortcut.
- After destination writes: do not simply flip URLs back. Capture and reconcile new destination records/updates before returning to source; stop writes again as needed. This reverse reconciliation must be prepared before the live switch.
- Observe real submissions and staff workflows; independently retain backups. Recheck external consumers and old deployments before pausing the source.
- Owner explicitly approves source retirement only when no remaining consumers and rollback gates pass. Pausing/deletion and creation of staging are separate dashboard actions.

## Next engineering work

Prepare the private export/backup wrapper, restore test, destination/source preflight checks, and actual writer coordination mechanism. No owner credentials or customer records should be requested until their handling is implemented and reviewed. Downtime duration must come from the measured rehearsal and writer plan, not a speculative promise.