# Live cutover result — October 6, 2026

- Source `xxyncvaulboqytovgfrh` frozen with the write barrier; retained for recovery.
- Destination `jbrntsxmibfldocsuslt` imported 140 contacts, 140 inquiries, 696 events, and zero applications. Every typed record matched the fresh frozen snapshot through the hosted API before replay; all four embedding/query-shape checks passed.
- Production CRM URL and service key now target main. Normal intake mode deployed; durable SMS remains enabled. Canonical direct-intake acceptance returned 200 and created an independent contact, inquiry, initial note, and exactly one creation event in main.
- Six captured items accounted for: two inquiries replayed, one customer SMS history projected, and three staff/test SMS explicitly resolved after confirming inbox persistence and absence of a CRM contact. No inbox messages deleted. Queue empty at final check; this is not a permanent guarantee against future arrivals.
- Final observed totals: 143 contacts, 143 inquiries, 700 events, zero applications. All frozen-snapshot IDs retained. Sandy/Meghha contact separation verified.
- Two labeled migration-verification inquiries are retained; not real customers. Review/archive through normal staff workflow, not silent database deletion.
- Prior cutover and SMS deployments return 401 at generated URLs. Canonical app responds successfully. Owner confirmed live acceptance: a website lead submission worked, past leads looked correct, and SMS looked correct. Staff may resume normal work; source remains frozen and retained.
- Private final snapshot, source/main archives, and operator SQL retained outside Git in `/Users/brunowong/odeon-private/migration/final-crm`.
- Phone matching in SMS history replay now normalizes formatting. Exact replacement SQL and duplicate replay tested in disposable PostgreSQL before successful live installation.
- Durable SMS continues to queue CRM history independently of inbox receipt. Future history projection requires ongoing reviewed draining/resolution; login reconciliation restores inbox messages but does not automatically drain CRM history. Do not purge pending receipts.
- Production environment switched; local `.env.local` and historical private operator configurations were not switched. Do not run old CRM maintenance tools against the frozen source.
- Do not reverse environment variables as a rollback: destination now contains post-snapshot activity. Use guarded reverse reconciliation if recovery is required. Retire source only with separate owner approval after observation and acceptance.

# CRM consolidation: read-only inventory

## Scope and status

The four CRM tables have been consolidated into Odeon's main database without merging contact identities. Import, production connection switch, queue resolution, and owner live acceptance are complete. The old project has not been paused or deleted. Older rehearsal sections below describe their historical status; the live cutover result above is authoritative.

### Live progress — October 5, 2026

- Isolated identity/creation-note hotfix deployed; owner confirmed UI behavior.
- Owner executed the guarded Sandy contact repair; independent read-only API checks confirmed separate contacts, preserved Meghha contact ID, consistent Sandy history links, and one repair audit event.
- Owner installed `10-install-capture.sql` on main; SQL output ended in COMMIT.
- Independent hosted checks passed: queue columns readable with service role, capture/SMS RPCs exposed, anonymous capture refused (401).
- Tonight: production callback mode set to capture and current production revision redeployed Ready (`dpl_7jFjrExeAAW8b6QCXpPgPe3DgVH3`). Staff pause acknowledged by owner. Source remains unfrozen; no import or CRM connection switch has occurred.
- Public intake acceptance passed: synthetic labeled inquiry returned 202, its durable main queue receipt was verified, and retry returned the same receipt. Synthetic item retained for replay, receipt stored privately in `/tmp/odeon-capture-test-receipt.json`.
- BLOCKER before source freeze: three known older deployment URLs still execute intake (invalid-body POST returned 400, not deployment protection). Older deployed environments are immutable and bypass current capture. Must protect/retire old intake endpoints and verify website/callback destinations before freezing; do not mistake canonical-alias capture for complete writer fencing.
- Owner enabled Standard Protection. Three previously exposed older deployment URLs now refuse unauthenticated POST (401); canonical intake still returns the same verified durable 202 receipt.
- Provider check found SMS webhook pointing at the protected project-generated domain (302). Updated only SMS URL/method to canonical `https://app.headlinerma.com/api/twilio/webhook` / POST and independently reread provider configuration; voice/fallback/status URLs unchanged. Private pre-change copy: `/Users/brunowong/odeon-private/secrets/twilio-cutover/number-before.json`.
- Production signature base confirmed as `https://app.headlinerma.com`. Real signed SMS acceptance remains the next gate. Source remains unfrozen; no record import or connection switch.
- Capture-capable isolated release deployed Ready (`dpl_EmCw1BJvp5skgasnPdmwmfaLNcps`) on app.headlinerma.com. App HTTP check passed (200); unsigned form-encoded SMS/voice callbacks refused (403). Signed delivery and durable intake acceptance remain to be verified after activation.
- A fresh final CRM snapshot must include the repaired identities; historical counts/backups are not the final migration baseline.

Database evidence below was supplied by the owner from read-only SQL results. It is not an independent production connection or a cutover-time snapshot.

## Verified from supplied results

- CRM exact counts: crm_contacts 137; lead_intakes 137; lead_events 650; job_applications 0.
- Both projects contain the same complete tenant UUIDs ending in 0001, 0002, and 0003. Owner-supplied results also match names and demo flags: Headliner Music Academy (false), Sacramento Martial Arts (true), and Kumon Learning Center (true). Reuse main tenant records unchanged.
- The four CRM table names were absent from the supplied main-project table inventory.
- Keep the main tenants table unchanged: its definition differs from CRM and includes last_synced_at.
- All four cross-tenant relationship checks returned zero problems: intake/contact, event/intake, event/contact, application/contact.
- CRM indexes, foreign keys, defaults, five user triggers, and three trigger functions were supplied.
- No policy rows were returned by the CRM inventory query. Earlier supplied results report RLS enabled on all five CRM tables.
- Main returned no public functions named set_updated_at, categorize_lead_intake, or log_lead_intake_created.
- Owner reports no Storage buckets in the CRM project; no Supabase Storage object migration is identified.
- Owner confirms no other app directly uses the CRM database. This is owner confirmation, not an independent audit of all external connections.
- Owner confirms website Production settings: NEXT_PUBLIC_FORM_DELIVERY_MODE=shadow and NEXT_PUBLIC_CRM_API_BASE_URL=https://app.headlinerma.com. The inspected formDelivery.js sends EmailJS first, then separately submits to Odeon's /api/intake; that path does not directly access the CRM database. Keep these website settings unchanged during consolidation. The local website proxy still has an obsolete fallback destination; track its correction separately.

## Required migration behavior

- Preserve IDs, timestamps, categories, statuses, payloads, and relationships.
- Do not deduplicate or merge CRM contacts into people during consolidation.
- Load historical records before installing CRM user triggers. Otherwise classification can change historical values and the insert trigger can generate extra created events.
- Load contacts before intakes/applications, and intakes before events.
- Enable RLS and explicitly restrict browser-role access on destination CRM tables; preserve required backend service-role access. Do not mechanically copy all source grants.
- Recheck counts and reconcile IDs/content at cutover; current counts can change with live submissions.
- Account for every writer and incoming submission during the switch. Do not assume a URL change provides an atomic cutover.

## Remaining gates

1. Prepare and review destination SQL and verification scripts locally.
2. Tenant labels/demo flags match; no CRM Storage buckets and no other direct app consumers are reported by the owner. Reconfirm writers before cutover; owner confirmation does not exclude unknown automations or old deployments.
3. Obtain a private backup/export, not customer records pasted into chat or committed to Git.
4. Rehearse schema and behavior with synthetic data in local PostgreSQL.
5. Agree write handling, validation, and rollback for cutover before any production changes.
6. Import and reconcile under that plan, switch the backend connection, and smoke-test workflows.
7. Retain the old CRM until rollback and no-remaining-consumer gates pass; do not delete it merely to free a project slot.

## Local rehearsal completed

Docker Desktop was installed by the owner. The rehearsal passed on an isolated PostgreSQL 17 container with no network and no published ports. Only the image download required external access. No environment files or live connection settings were loaded; the temporary container and its volumes were removed afterward.

Files (drafts, NOT approved for production execution):

- `scripts/crm-consolidation/01-schema.sql`: creates the four tables, source indexes and foreign keys, RLS, and explicit backend-only grants. Does not replace tenants. Deliberately fails if tables exist.
- `scripts/crm-consolidation/02-triggers.sql`: installs namespaced trigger functions after historical import. Preserves source classification/event/update behavior.
- `scripts/crm-consolidation/rehearse.cjs`: executable local-only synthetic rehearsal. Run with `node scripts/crm-consolidation/rehearse.cjs` from the repository root.

Verified with fake records: historical IDs/category/status/timestamps remain unchanged; no duplicate historical events; all seven classification examples pass; new inquiries generate correctly linked created events; contact update timestamps advance; application insertion works; missing-contact foreign keys reject invalid records; tables have RLS and checked browser privileges are absent. These are direct SQL checks, not an end-to-end Supabase API/browser test or full record-transfer rehearsal.

Historical status at the synthetic rehearsal: private export and real-data transfer were still pending. See the actual-backup rehearsal below for the updated status. No production destination writes or connection switch have occurred. Inventory counts are not cutover-time counts.

## Synthetic export/import rehearsal completed

`03-export-snapshot.sql`, `transfer.cjs`, and `rehearse-transfer.cjs` now prepare and test a selected-table consistent JSON snapshot and transactional import. The Docker test passed complete typed-record comparisons, special-character/nested-data cases, empty tables, historical preservation, and post-import trigger behavior. Nonempty destinations, tenant/column mismatches, duplicate IDs, foreign IDs, cross-tenant links, and active triggers were refused; failed imports left no records. No live connections, private snapshots, or credentials were used.

See `docs/crm-consolidation-transfer-plan.md` for exact scope and cutover gates. A selected-table snapshot is not a full backup. Private export/backup execution wrappers, full backup restore tests, real-data rehearsal, API checks, writer coordination, and post-write rollback remain pending. Do not run draft SQL in production yet.

## Private backup preparation

`backup-private.cjs` now drafts an explicitly authorized read-only export runner for either project, with TLS verification, private password/config files, output manifests/digests, and suppressed raw subprocess errors. Its live path has not been executed or integration-tested. `private-artifacts.cjs` enforces owner-only storage outside repositories; refusal guards pass unit tests.

The expanded local transfer rehearsal wrote a synthetic custom-format PostgreSQL backup and restored it into a separate disposable database. All snapshot fields matched; five user triggers, four RLS-enabled tables, checked grants, and new backend inquiry/event behavior passed. Synthetic private files and containers were removed.

See `docs/crm-private-backup-guide.md`. Remaining: trusted native client setup/direct connectivity, private credential handling and owner export authorization, real backup/restore coverage including hosted dependencies, fresh schema/API verification, writer coordination, and reverse reconciliation. No live access or export occurred.

## Actual private CRM backup and transfer rehearsal — October 5, 2026

- Owner successfully tested the CRM session-pooler connection with verified TLS and a read-only SELECT, then exported a custom-format archive using PostgreSQL 17 in Docker. Credentials were entered privately, not supplied in chat.
- The archive inventory is readable: server version 17.6, dump client 17.11. It contains public and managed schemas; this is not a backup of dashboard settings or Storage objects.
- The public schema was restored locally with original owners/grants excluded. Actual counts: crm_contacts 137, lead_intakes 138, lead_events 655, job_applications 0, tenants 3. These supersede earlier inspection counts for this snapshot only.
- The actual restored records were exported locally and imported transactionally into the draft destination CRM schema. A main-shaped tenants fixture was populated from the snapshot; this was NOT a restore of Odeon's main database.
- Full snapshot equality passed before and after trigger installation: every exported field, ID, timestamp, and history record matched, with no extra history events. Five user triggers and four RLS-enabled destination CRM tables were verified.
- Docker networking was disabled; no ports were published or live connections attempted by the rehearsal. Private data and generated import SQL were not printed or committed. A non-PII report was saved beside the private archive outside the repository.
- Temporary real-data containers and their volumes were removed. Removal is not a secure-erasure guarantee.
- Remaining gates: main database backup/recovery coverage; rehearsal against the actual main schema; Supabase API/application smoke tests; coordinated writes and final snapshot; rollback after new destination writes; explicit live-cutover approval.
- Tour-request UI visibility is explicitly deferred until after consolidation. Preserve its existing records unchanged.

## Main backup inspection — October 5, 2026

- Owner completed the main database export using a privately entered password. The archive is stored outside the repository with owner-only permissions.
- Archive inventory is readable: server 17.6, dump client 17.11; 42 public data tables plus managed auth/realtime/storage/vault schemas.
- A transactional public-only restore was attempted in a network-disabled PostgreSQL 17 container with no published ports. It failed because the public schema references the managed auth schema. Raw restore diagnostics remain in the private backup directory and were not printed.
- The temporary container and volume were removed. This failure is a local compatibility limitation, not evidence of production damage or proof the archive is unusable.
- Main recovery is NOT verified. Do not bypass foreign keys or fabricate auth objects and call that a complete restore. Determine and restore compatible managed dependencies before rehearsing against the actual main schema.
- No live database connections, production writes, deployments, or connection-setting changes were made during this inspection.

## Combined actual-backup rehearsal — October 5, 2026

- Restored actual main public and auth archive entries together in isolated PostgreSQL 17. Required anon/authenticated/service_role roles were local NOLOGIN fixtures; service_role used BYPASSRLS. Original owners and ACLs were excluded. This verifies selected schema/data recovery, not full hosted-service recovery or original grants.
- Restored the actual CRM public archive into a separate database in the same network-disabled container.
- Applied the draft CRM schema to the restored main database, imported the CRM snapshot, and installed the draft triggers. Full CRM snapshot equality passed before and after trigger installation.
- Compared all rows of all 42 pre-existing main public tables before and after consolidation using bidirectional EXCEPT ALL comparisons. All remained unchanged, including main tenant records.
- Private non-PII report saved beside the main archive. No customer records, password, or import SQL were printed. The temporary container and volume were removed; this is not secure-erasure assurance.
- Remaining: original permission/managed-service recovery coverage, application/API checks, reviewed writer coordination/final snapshot, post-write rollback, and explicit production cutover approval. Neither production database nor Vercel was changed.