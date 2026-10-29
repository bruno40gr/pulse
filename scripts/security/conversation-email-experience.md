# Saved conversation experience — October 29, 2026

## Agreed scope

Opening Conversations must read saved lead emails rather than rebuild the selected range from Gmail. Current-month history is queued by the authenticated scheduled sync, without requiring a browser visit. New, previously unloaded date ranges import on demand and remain saved. This is not instantaneous Gmail push delivery.

## Implementation

- `lib/gmail/conversation-preload.ts` discovers connected mailboxes in pages, resolves each tenant's lead audience once, and queues the default calendar month. It shares the same deterministic import key as API reads, so recurring schedules preserve completed imports and unfinished checkpoints.
- `lib/gmail/conversation-store.ts` exposes the shared queue operation. Stored-mode reads do not call Gmail. Existing worker permission checks still guard provider access.
- `app/api/internal/gmail-sync/route.ts` queues preloads before processing conversation jobs, within the existing work budget and only with `CONVERSATION_EMAIL_STORE=1`. Preload failure does not prevent existing queued jobs or legacy note capture.
- `components/inbox/Conversations.tsx` publishes each completed saved-list read together instead of publishing individual pages with changing counts and attention indicators. Saved results remain visible during refreshes.

## Validation for this increment

- 77 focused tests passed: preload, stored API, store/worker, scheduler, refresh, Gmail conversations.
- TypeScript, targeted ESLint, and diff whitespace checks passed.
- Intercepted browser checks passed at 1440, 900, and 390 pixels: import updates open detail, delayed sync retains saved messages, deletions reconcile, unsent drafts remain intact. No real mailbox writes.
- Evidence: `/tmp/pulse-gmail-preload-tests.log`, `/tmp/pulse-gmail-preload-browser.log`.

## Release status and limits

Local candidate only. No production migrations, deployments, flag changes, or first import were performed. Existing migration/deployment requirements in `conversation-email-store-rollout.md` still apply; this increment does not resolve them or add another migration. The five-minute scheduler determines update cadence. The first import and previously unseen historical ranges are not promised to load instantly. Live mailbox completeness and actual load time remain unverified.

The installed Next.js package does not contain the requested `node_modules/next/dist/docs/` directory; this increment adds no new Next.js APIs or dependencies.

## Release continuation — October 29, 2026, 19:16 UTC

A fresh read-only Supabase backup-list check still returned `backups: []`, `physical_backup_data: {}`, and `pitr_enabled: false`. External backups remain unknown. Production activation is blocked on a verified recovery artifact; no migration, scheduler pause, feature flag change, or deployment was performed. Do not treat the local checkpoint as a deployed release or deploy it before its required migrations.

### Correction after checking local Docker and private artifacts

Actual external database archives do exist under `/Users/brunowong/odeon-private/backups/`. Their inventories were successfully read with PostgreSQL 17 `pg_restore --list` through Docker, without restoring or exposing records. The main archive was created October 5, 2026 at 15:39 UTC; the CRM archives were created October 5 at 15:26 and 18:48 UTC. Existing reports document local restore/transfer rehearsals that day, not a full managed-platform recovery.

These archives predate the current Gmail connection schema: none contains `public.gmail_connections`; the main archive also predates the consolidated lead tables. They establish that backups were previously taken, but are not a current pre-migration recovery point. A fresh backup is still needed for this release. The running `pulse-email-store-test` container holds small synthetic test databases, not the current production database. No existing container, volume, or backup was modified or removed.

### Fresh backup completed — October 29, 2026, 20:07 UTC

With explicit owner approval, a read-only PostgreSQL custom-format export of project `jbrntsxmibfldocsuslt` completed over TLS `verify-full`. Artifacts are outside Git at `/Users/brunowong/odeon-private/backups/gmail-release-20261029T200717Z`, owner-only on a FileVault-enabled Mac. The 1,079,315-byte archive checksum is `7fd1ae8ebe74576dc8f9bf1cbcc602d2086e31303171937aca1f752c7386d06c` (SHA-256).

At 20:09 UTC, actual `public` and `auth` schema/data restored successfully in a new network-isolated PostgreSQL 17 container. Verification queried restored Gmail connections, lead intakes, CRM contacts, and authentication users. The temporary container and its volume were removed; the previous test container and all old backups were retained. Archive inventory, private restore log, and manifest with counts/checksum/recovery scope remain alongside the archive.

Recovery scope: this is a single-database archive, not Storage object bytes or Supabase project configuration. The local restore used fixture roles/extensions and excluded original ownership/ACLs; it does not certify full managed-platform recovery. The backup prerequisite now has a fresh verified application/auth recovery artifact. This does not mean migrations have been applied, maintenance/drain has happened, or the candidate is deployed. Reassess backup age if rollout is delayed.