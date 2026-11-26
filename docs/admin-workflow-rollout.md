# Session release — November 26, 2026

Mentions/history and shared email-template management are being released on current main.

Production template storage was installed and verified on November 26, 2026: RLS enabled; no direct browser access; service role limited to select/insert/update. No existing business records changed. An isolated PostgreSQL rehearsal passed before installation.

Release checks: all 1,204 current-main security tests passed, TypeScript and targeted ESLint passed, shared-template browser checks passed at 1440/900/390px. This count differs from the older release worktree because unfinished calendar tests are not part of current main.

Application rollback target: deployment dpl_3L7e2oAPZExWvJQgnPj1Ly981zNx (previous production). Retain template storage and saved changes during application rollback; do not drop the table. No messaging/payment write smoke tests authorized or performed.

Historical sections below describe earlier local and production states, not the current release status. The older rollout record below is retained as historical evidence. No unfinished calendar paths or follow-up refinements are included.

# Admin workflow rollout

## Current status and next feature — corrected November 26, 2026

**This section is the current roadmap. Everything below is historical execution evidence, not a backlog or a fresh statement of production state.** Do not infer missing functionality from the older release worktree or repeat its November 24 sequence without checking newer main commits and current code.

### Already implemented — do not propose rebuilding

- Person-linked follow-up notes and dates/deadlines, with lead/contact context. Remaining notification or scope refinements are changes to existing functionality, not a new follow-up product. Do not infer current enablement solely from the dated migration notes below.
- Profile-adjacent email and SMS composition with full-width expansion, retained drafts, shared header and Cancel/Send controls. Verified against main's November 25 commits `190cfba`, `47e8c91`, `6046578`, `645a588`, and `6b9fd80`; current `ProfileComposerLayout` expands to `100dvw` when composing and keeps profile/composer panes mounted. The older proposal to switch within the existing-width panel is obsolete.
- Production contact profile unification and legacy panel retirement: main `07c1e870ab4ee1880e3c69038bda52bf82d69414`.
- Mentions inbox improvements and sticky-note task-control retirement are implemented locally on the release line, with validation recorded below. Not deployed by this session.

### Shared email-template management — local implementation, November 26, 2026

- Owner clarified that School Setup and the existing composer modal should manage the same library. Neither is a separate copy. The previous restriction to School Setup alone is superseded.
- Local release changes add tenant-scoped create/edit/archive operations and a shared editor in School Setup → Email templates and each live email composer. Readers retain selection access; owners and communications senders can manage templates. Fictional preview composers stay local.
- Approved defaults remain unchanged in source; persisted overrides and archive records prevent removed defaults from reappearing. Version checks reject stale edits. Preserve placeholders, signature insertion, draft replacement confirmation and existing messages.
- The additive migration is prepared but not applied. No production writes, deployment, commit, merge or push. Current-main profile/messaging files have not been overwritten. See `docs/shared-email-templates.md` for installation and refresh behavior.

Historical backup, migration, privilege and recovery evidence below is intentionally retained. Deleting it would discard useful safety records; it must not be used as the current feature roadmap.

## Scope correction — mentions, not task management — November 26, 2026

- Owner clarified that mentioned staff need a reliable place to see and revisit mentions, not assignments, task statuses or completion tracking. This supersedes the earlier requirement to retain note-to-task conversion until a replacement task workflow is accepted.
- Retain follow-up notes and dates/deadlines shared across reliably linked Leads and Contacts, with notifying staff mentions. A mention is a notification, not ownership. Do not enable shared follow-ups or add assignment/completion UI on the strength of the earlier roadmap.
- Local changes in this slice: existing notification panel gains My mentions filtering, paginated older/newer browsing, and History including dismissed records. Opening history marks the notification read and links to its original source; it never completes the underlying note. Badge counts remain scoped to unread, undismissed notifications. No separate task destination or schema migration.
- Sticky-note composer and inline editor expose the existing @ Mention picker. Remove Create/Convert to task, suggested ownership, task editor and task-only filters. Retain ordinary note completion, privacy, replies, and historical saved data; legacy task APIs/schema are deliberately not deleted in this UI-only slice.
- Shared follow-up mention persistence/notifications and removal of its existing Complete control are still pending reconciliation. This slice does not modify follow-up persistence or claim that shared follow-up mentions are implemented.
- Work performed with owner confirmation that the other session is paused, in `/Users/brunowong/pulse` on the existing release line. No merge, commit, push, deployment, feature enablement or production writes.
- Validation: all **1,283 security tests passed**, TypeScript `--noEmit`, targeted ESLint and `git diff --check` passed. New isolated component tests cover loading/error states, filters, pagination and source navigation; API tests cover recipient/tenant isolation, history and pagination boundaries. No real-browser visual check or production notification delivery test was performed for this slice. Full suite log: `/private/tmp/mentions-full-suite-final.log`.

## Production database support installed; feature remains off — November 24, 2026 Pacific

- Owner explicitly approved installing the corrected database support only, keeping the feature off and excluding deployment/configuration changes and production test edits.
- Refreshed the private production archive because the previous recovery point was over an hour old. New private recovery directory: `/Users/brunowong/odeon-private/backups/backup-Xf4538/`. Verified its digests, restored actual application/Auth data offline and reran the corrected migration with hosted destructive default grants. Also rehearsed the exact guarded execution wrapper and migration-ledger insert offline. An initial local restore hit PostgreSQL initialization readiness; corrected readiness to wait for the final TCP listener and completed both restores successfully. No production retries occurred.
- Applied **only** `202611240005_shared_follow_ups.sql`, SHA-256 **`73f9116ec19a6228d8f546b0ee3c67ce5cceb6469bccf1122b586a5ff6cd6d73`**, using a pinned Docker PostgreSQL client and verified TLS. Single guarded transaction: 10-second lock and 120-second statement limits, advisory/affected-table locks, fresh inquiry fingerprint gate, collision checks, migration, postconditions, then ledger insertion and commit. Exact approved SQL stored in `supabase_migrations.schema_migrations` under version `202611240005`, name `shared_follow_ups`; no bulk migration push or identity/calendar migration replay.
- Commit reported successful. Separate enforced read-only postflight at **2026-11-25 07:45:34 UTC** (November 24 Pacific) confirmed: ledger entry present; **196 inquiries and 1,596 lead events unchanged**, identical full inquiry-row fingerprint (including payloads/timestamps); **42 follow-ups, all open and unlinked, and 42 history snapshots**; both tables have RLS; browser-role reads denied; service-role destructive privileges absent. In-transaction checks also verified exact backfill mapping, intended bounded grants, RPC permissions, indexes and triggers.
- Private evidence: `migration-execution-evidence.json`, `migration-postflight.json`, `approved-migration-execution.sql`, `restore-evidence.json`, `migration-hosted-acl-evidence.json`, and `migration-wrapper-evidence.json` in the new recovery directory. Temporary restore/client containers removed. No customer data or secrets printed.
- No application deployment, flag change, production write acceptance, commit or push. Shared follow-ups remain disabled under the previously verified production flag state; no new production metadata fetch in this step. Existing Leads reminders remain available and note-to-task conversion retained. Next gate is scoped release/deployment review and separate explicit application promotion/enablement approval; no old Won-clearing deployment can be promised as a semantics-preserving rollback.

## Hosted-default privilege correction validated — November 24, 2026 Pacific

- Fixed the preflight-discovered ACL inheritance issue locally by adding service_role to the explicit table-level REVOKE ALL before bounded grants. No global default privileges changed. Corrected migration SHA-256: **`73f9116ec19a6228d8f546b0ee3c67ce5cceb6469bccf1122b586a5ff6cd6d73`**. Previous hash/conditional approval must not be reused for this changed artifact.
- Repeatable synthetic PostgreSQL runner now installs the hosted destructive default grants before running the fixture. Verified actual service-role operations still work; actual TRUNCATE attempts by anon/authenticated/service_role fail without data/history changes; DELETE/TRUNCATE/REFERENCES/TRIGGER privileges are absent on both shared tables. All prior rejection/atomicity checks pass.
- Re-restored the production archive offline, reproduced postgres hosted table defaults, and applied the corrected migration. Final rehearsal passed exact backfill (42 open/unlinked reminders and history), unchanged inquiry fingerprint/events, mappings, RLS, indexes/triggers and absence of destructive grants across all three API roles. Private evidence: `/Users/brunowong/odeon-private/backups/backup-D4BiW8/migration-hosted-acl-evidence.json`. One earlier disposable attempt did not complete; only the final successful evidence is relied upon.
- Focused Node suite passed 23/23; PostgreSQL behavioral/ACL/failure-atomicity checks passed. No production schema/data/ledger change. Await renewed approval of this corrected migration before the hosted execution transaction; retain previous exclusions (deployment, feature enablement and production write acceptance).

## Production preflight stopped migration — November 24, 2026 Pacific

- Owner explicitly approved applying only the exact shared-follow-up migration, conditional on passing hosted preflight; deployment, enablement and production write tests excluded.
- Enforced read-only hosted preflight succeeded and confirmed correct Odeon identity, PostgreSQL 17.6, 196 inquiries, 24 linked inquiries, 42 reminders, 1,596 lead events, absent target tables/functions and no shared migration ledger entry. Full inquiry fingerprint still matches the fresh backup/rehearsal.
- **STOP: production default privileges differ from the isolated restore fixtures.** The `postgres` public-table default ACL grants `Dxtm` (DELETE, TRUNCATE, REFERENCES, TRIGGER) to service_role (also anon/authenticated). The reviewed migration revokes ALL from PUBLIC/anon/authenticated but does not revoke inherited service_role privileges before granting its intended bounded access. Therefore the new tables would retain service_role DELETE/TRUNCATE/etc.; history would retain UPDATE-independent destructive rights. Existing offline fixtures did not reproduce these hosted defaults.
- No production DDL, DML or migration-ledger write performed. Conditional preflight gate correctly prevented migration. Do not execute the previously approved hash unchanged.
- Required correction: explicitly revoke ALL table privileges from service_role before the bounded table grants, reproduce hosted default ACLs in regression tests and rerun the production-data rehearsal with those defaults. This changes migration SHA-256 and requires renewed exact-migration approval before execution. Do not modify global production default privileges as a workaround.
- Private preflight evidence: `/Users/brunowong/odeon-private/backups/backup-D4BiW8/migration-preflight.json`. Treat as private metadata; do not copy historical ledger rollback statements into public output. Follow-ups remain off; conversion preserved.

## Final offline production-data rehearsal — November 24, 2026 Pacific

- Applied the exact reviewed migration (`202611240005_shared_follow_ups.sql`, SHA-256 `ced46bf6548347354a88f3274bb01ad8fcaa8ef7e29e4d2f01bb07e9f1288ec2`) to a fresh isolated restore of the approved production archive. No identity prerequisites replayed. Used the migration transaction with 10-second lock and 120-second statement timeouts, network-disabled Docker, tmpfs storage, no production credentials and private diagnostics.
- Migration succeeded on actual restored data. Backfilled **42 open reminders, all 42 unlinked**, with 42 initial history snapshots. Checked exact tenant/person/date/message mapping, RLS, scoped privileges, both triggers and all five follow-up indexes. Full inquiry-row fingerprint (including payload and timestamps) and lead-event count remained unchanged. Contacts must not invent identity links for those reminders.
- Private evidence: `/Users/brunowong/odeon-private/backups/backup-D4BiW8/migration-rehearsal-evidence.json`. This is offline migration compatibility evidence; restored original ownership/ACLs were excluded, and limited privilege checks do not replace hosted preflight.
- Fresh validation: **1,287 Node tests passed**, zero failed; repeatable PostgreSQL behavioral/role/failure-atomicity rehearsal passed. Logs: `/private/tmp/admin-follow-up-final-tests.log`, `/private/tmp/admin-follow-up-final-postgres.log`. TypeScript result is recorded separately in `/private/tmp/admin-follow-up-final-types.exit` and `.log`.
- Reviewed recorded production rollback commit `a62acba3a46a12f8d51a2dfa371466ed69a74324` directly: its Leads PATCH explicitly clears `follow_up_at`/`follow_up_note` for Won in the payload path. **It is not a semantics-preserving rollback after enablement.** Do not promise a simple deployment rollback preserves reminders; suspend Won operations during rollback or prepare/review a narrowly scoped forward fix. Preserve shared records/history and compatibility triggers; no automatic database DROP or whole-database restore.
- Remaining gates before live migration: explicit exact-migration approval, hosted schema/ACL and migration-ledger preflight, tracked single-migration execution plan (no pending-migration bulk push), verified recovery owner and affected-row recovery scope. Deployment/flag enablement and production synthetic-write acceptance remain separately authorized. Working tree is still uncommitted; no deployable release commit has been produced. Feature remains off and conversion retained.

## Approved production backup and isolated restore completed — November 24, 2026 Pacific

- Owner explicitly approved a fresh read-only Odeon production export and isolated Docker restore verification. No approval was given for production migrations, application deployment, feature enablement or write acceptance.
- Reused existing saved Odeon session credentials and copied the previously supplied CA into a new owner-only private directory. TLS `verify-full`, explicit project authorization and read-only session defaults were retained. Production server reports PostgreSQL 17.6; installed client image provides PostgreSQL 17.11.
- Fresh archive completed at **2026-11-25 05:46:00 UTC** (November 24 Pacific). Private recovery directory: `/Users/brunowong/odeon-private/backups/backup-D4BiW8/`. Archive is 1,624,981 bytes; manifest contains artifact SHA-256 digests. All recovery files checked owner-only; FileVault On and approximately 90 GiB free at readiness check. No customer records or credentials printed.
- Independently checked archive digests and restored **actual public/Auth schemas and data**, atomically with exit-on-error, into a disposable network-disabled PostgreSQL 17 container with tmpfs database storage, no published ports, no production credentials, no Docker output logging and no archive volume. Original ownership/ACLs excluded; fixture roles/extensions supplied. Restore succeeded at **2026-11-25 05:47:05 UTC**. Checked restored counts: 196 inquiries, 1,596 lead events, 384 people, 60 contacts, 12 Auth users. These are restored counts, not an independent live-data equality comparison.
- Evidence is `/Users/brunowong/odeon-private/backups/backup-D4BiW8/restore-evidence.json`; original export manifest intentionally remains `restoreVerified: false`, with the separate evidence recording successful scoped restore. Restore diagnostics are private and empty. Restore/client containers were removed.
- This establishes a fresh scoped logical recovery point for application/Auth data, **not** full Supabase platform recovery, Storage object recovery, original ownership/ACL validation, or a production restore procedure. Writers were not paused; this is not the coordinated final migration snapshot. Reassess freshness and migration-specific recovery sufficiency immediately before any separately approved migration.
- No production migration, deployment, feature enablement, production write acceptance, commit or push performed. Follow-ups remain disabled and note-to-task conversion retained. Next: review exact migration/rollback scope and request separate, explicit migration authorization before touching production schema.

## Correction: existing private credentials located — November 24, 2026

- Owner correctly noted that connection material had already been provided. Recursive metadata-only discovery located `/Users/brunowong/odeon-private/secrets/gmail-release-backup/pgpass`: owner-only 0600, one structurally valid entry with a nonempty password and Odeon project identity in the host/user. No credential values were displayed and no database connection was attempted. Earlier missing-credential statements reflect an incomplete search and are superseded.
- The previously referenced CA exists at `/Users/brunowong/Downloads/odeon-main-ca.crt`. Its trust, ownership/permissions and suitability for the strict private-file guard still require verification before use. Saved-password validity has not been tested.
- Existing `/Users/brunowong/odeon-private/backups/gmail-release-20261029T200717Z/manifest.json` identifies Odeon, completion on October 29, 2026, and `restoreVerified: true`. This is historical recorded evidence, not independent verification in this session or a current pre-migration recovery point. Reassess freshness, integrity and restore scope rather than claiming no historical backup exists.
- Do not ask the owner to resend secrets. Reuse and safely validate existing private material. Specific approval is still required before a fresh production export and isolated restore; no production access or export occurred during this discovery.

## Docker execution path added — November 24, 2026

- Added an optional Docker path to the private backup runner; native mode remains available. Requires an absolute Docker executable, local Unix-socket context and pinned already-installed image ID. No automatic image downloads, password arguments/environment, writable credential mounts, archive volumes or Docker output logs.
- Read-only database/TLS settings and explicit matching-project authorization are retained. Archive inventory streams host input to a separate network-disabled client; timed-out clients are removed. Live export still requires approved network access and verified production credentials.
- Validation: all 12 `scripts/crm-consolidation/*.test.cjs` tests passed; new synthetic-only Docker rehearsal passed archive inventory, local restore and Unicode-row verification, then removed its container and temporary archive. Database storage was tmpfs with no published ports and no external network. This does not validate production TLS access, hosted-schema restore or a production recovery point.
- No production connection, export, restore, password reset, migration, deployment, commit or push was performed. Follow-ups remain disabled. Next gate: securely prepare the correct Odeon password file, CA and connection configuration, then obtain specific export-and-isolated-restore approval.

## Docker backup-tool readiness — November 24, 2026 Pacific

- Owner confirmed Docker availability. Verified local Docker client/server and the already installed `postgres:17` image; its `pg_dump` and `pg_restore` both report PostgreSQL 17.11. Version checks ran in disposable read-only, network-disabled containers; no image download or database connection occurred. Native PostgreSQL installation is not inherently required.
- FileVault reports On. `/Users/brunowong/odeon-private` is owner-only (0700), not itself a symlink, with approximately 89 GiB available at inspection. These checks do not establish that all parent paths are unsynced or that Docker's storage is suitable for retaining customer data.
- Existing `scripts/crm-consolidation/backup-private.cjs` currently invokes native binaries; Docker availability alone does not make that runner Docker-ready. A reviewed container execution path is required before using it for live export. Use a pinned local image, verified TLS, private read-only credential/certificate mounts, and host-private archive output; never place passwords in Docker arguments/environment or leave customer archives in container layers/volumes. An isolated restore must not invoke unreviewed production code or contact providers.
- No configured owner-only database passfile or backup configuration was found in the checked locations, and no PostgreSQL database password was available in the process. A project-verified connection and server CA are still needed; API service-role keys are not database passwords. Do not assume the historical inactive CRM session connection belongs to consolidated Odeon production.
- No production export, restore, credential reset, migration, hosting change or paid backup enablement has been performed. Docker resolves the client-tools requirement, not the remaining connection/authorization/recovery-verification requirements.

## Vercel access restored; recovery still open — November 24, 2026 Pacific

- User explicitly selected help restoring hosting access and verifying recovery, not deployment. Saved Vercel access-token metadata showed expiry at November 24, 2026 11:21:31 UTC. The installed Vercel CLI's normal `whoami --json` successfully renewed the existing session; no alternative identity, permission change or manual credential disclosure was used. Subsequent project/deployment/environment metadata GETs succeeded. Earlier 403 findings below are historical and no longer the current access blocker.
- Current production target: `dpl_F6wDP3i8bvDZ7cbDEjWKN5UNWWE9`, READY, commit `a62acba3a46a12f8d51a2dfa371466ed69a74324`, production branch `main`. Deployment aliases include `app.headlinerma.com` and `leads.headlinerma.com`. This is the pre-follow-up rollback candidate, not proof of authenticated workflow acceptance or assurance that old Won-clearing semantics are suitable after enablement.
- Retrieved production environment **metadata only** (`decrypt=false`); both Supabase URL variable names and service-role alias names are configured for production. `NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS` is absent. URL/key values were not decrypted. The current deployment build events contain the exact existing verifier success marker for production database aliases, OAuth origin, encryption and scheduler. Together with the source verifier at that commit, this supports the built production routing contract to Odeon `jbrntsxmibfldocsuslt`, without exposing secrets. Future promotion needs the same build verification.
- Evidence: `/private/tmp/admin-follow-up-vercel-renewed-metadata.json` (selected metadata) and `/private/tmp/admin-follow-up-vercel-build-evidence.json` (deployment/aliases/commit/verifier marker count). No raw build logs or environment values were persisted. The selected deployment metadata includes ordinary Git author metadata; no API credentials.
- Fresh Supabase backup list still returns no listed backups and PITR disabled. Backup-schedule GET returned **HTTP 402**; stopped at that restriction without alternate endpoints or attempts to change plan/configuration. Do not infer exact billing tier or absence of all internal provider recovery from this response. No usable production restore point has been verified.
- Remaining recovery decision: owner verifies provider-supported backup/restore coverage in the dashboard/support, or separately approves a private logical backup/export plus compatible isolated restore verification under `docs/crm-private-backup-guide.md`. No paid feature, backup schedule, export, database password reset, restore or deployment is authorized by the access-repair request. Existing service-role API keys are not database passwords. Keep credentials private; do not post them in chat.
- Shared follow-ups remain off. No production application/configuration/database changes, commits, pushes or promotions. Local validation is unchanged; stop adding redundant rehearsals while waiting for the recovery decision.

## Service-role permission rehearsal — November 24, 2026 Pacific

- Closed a test-coverage gap: earlier SQL behavior assertions ran as the database owner and inspected grants. The fixture now models inquiry RLS/service-role grants and a non-superuser `service_role BYPASSRLS`, and the runner actually switches roles to exercise the invoker RPC and audit/compatibility triggers.
- Actual service-role Save, Complete, reopen and Clear passed, preserving the inquiry projection and the distinct completion/clear semantics. Stale version, foreign inquiry tenant/person, and completion of an already cleared context reject without changing any inquiry, shared record or history row.
- Actual `anon`/`authenticated` table reads and RPC execution are denied. Service role cannot delete follow-ups or update/delete audit history under the migration grants. Actor membership and general Contact identity remain API-verified; the service-role RPC is not an end-user authorization mechanism or proof of arbitrary cross-database identity validity.
- Updated only `scripts/security/shared-follow-up-postgres.sql` and `scripts/security/check-shared-follow-up-postgres.cjs`, plus this record. Application and migration SQL are unchanged. Disposable PostgreSQL runner passed all five check groups, including prior malformed-data migration failure checks; container removed. Log: `/private/tmp/admin-follow-up-role-rehearsal.log`. Eleven focused API/summary tests passed; runner ESLint, syntax and whitespace checks passed. Route-test log: `/private/tmp/admin-follow-up-role-route-tests.log`.
- No remaining local rehearsal is a substitute for authorized hosting metadata and verified production recovery. Next release action requires those external gates; no forbidden hosting retry, production write, migration, configuration change, export/restore, commit, push or deployment occurred. Shared follow-ups remain off.

## Hosted verification and recovery checkpoint — November 24, 2026 Pacific

- Supabase `LIST_BACKUPS` for Odeon production (`jbrntsxmibfldocsuslt`) returned `backups: []`, `pitr_enabled: false`, `walg_enabled: true`, and empty `physical_backup_data`. This is backup-list metadata only: it neither proves all recovery mechanisms absent nor establishes a usable restore point. **Production recovery is not verified.** No backup/export/restore was initiated. Existing code reconciliation archives are not database backups; the historical consolidation manifest is not fresh restore evidence.
- Tool discovery did not expose a Vercel tool. Read-only GET requests using the saved local Vercel authentication to the explicitly configured project/team returned **HTTP 403** for project metadata, production deployments, and production environment metadata (`decrypt=false`). No token, secret values, or raw environment responses were logged. Sanitized status evidence: `/private/tmp/admin-follow-up-hosted-metadata.json`. Stop at the authorization boundary; do not use another identity or retrieve Supabase secrets as a substitute. Fresh live target, deployment SHA and rollback deployment remain unverified. An owner-authorized metadata check or authenticated access renewal is needed before promotion review can close.
- Added a repeatable offline Docker rehearsal: `node /Users/brunowong/pulse/scripts/security/check-shared-follow-up-postgres.cjs`. It uses PostgreSQL 17 with `--network none`, no host database port, no `.env`, and removes its disposable container. It runs the existing behavioral fixture plus separate invalid-date and overlong-message migration failures. Both failures preserve complete inquiry rows/timestamps and leave no shared tables/functions/trigger behind. This proves transaction failure atomicity on representative synthetic structure, **not** hosted backup restore or post-commit rollback. Log: `/private/tmp/admin-follow-up-recovery-rehearsal.log`; all three checks passed. New runner ESLint and `node --check` passed.
- Migration under review remains `supabase/migrations/202611240005_shared_follow_ups.sql`, SHA-256 `ced46bf6548347354a88f3274bb01ad8fcaa8ef7e29e4d2f01bb07e9f1288ec2`. Active release HEAD during this check: `b1542a461d47b6206967816cdf212f876188a2dd`; admin changes remain uncommitted, so this is **not** a deployable release commit identifier. Prior reconciled implementation hashes remain unchanged.
- **Ready locally, blocked from production execution:** need owner-authorized hosted metadata, verified recovery coverage/owner, exact reviewed release commits, and explicit migration/promotion/write-test approval. Do not spend more time rebuilding staging or treating repeated generic “continue” as production-change approval. A live private export also needs the separate approval required by `docs/crm-private-backup-guide.md`; never copy customer records into local fixtures.
- No production writes/migrations, backup exports/restores, configuration changes, deployments, commits or pushes. Feature remains off and note-to-task conversion/history remains intact. Do not remove conversion merely because migration rehearsal passed.

## Active release reconciliation — November 24, 2026 Pacific

- Current working implementation is now `/Users/brunowong/pulse` on the existing `release/integrated-staff-subscriptions-20261123` line. The earlier `/Users/brunowong/pulse-main` copy is retained unchanged as source/recovery context, not a second shipping line. Historical entries below describe the earlier local work.
- Reconciled 35 bounded files using the source HEAD as the three-way base. Retained the release line's subscription reader, family revisions/links, operational work-profile entry point, existing Notes expansion/auto-grow behavior, and ongoing Services/calendar edits. Existing tracked edits outside this slice were compared with their pre-edit diffs and are unchanged. Four conflicting files were reviewed and combined rather than replaced wholesale.
- Calendar work already uses migration version `202611240001`. The release migration is therefore **`supabase/migrations/202611240005_shared_follow_ups.sql`**; its SQL is unchanged from the tested source version. Do not apply the old `202611240001_shared_follow_ups.sql` from the source worktree or apply all pending calendar migrations as part of this feature.
- Pre-edit affected files, tracked patch/status, and before/after manifests are saved under `/Users/brunowong/pulse-backups/admin-follow-up-reconcile-20261124-205438/`. Archived file hashes were verified before applying edits. No branches/worktrees were removed or reset; no commits/pushes occurred.
- Integrated Node regression run: **1,275 tests passed, zero failed**. TypeScript completed with exit 0. Logs: `/private/tmp/admin-follow-up-integrated-tests.log`, `/private/tmp/admin-follow-up-integrated-types.log`, `/private/tmp/admin-follow-up-integrated-types.exit`.
- ESLint across the reconciled files reports 16 pre-existing `no-explicit-any` errors in the legacy Leads PATCH route; before/after lint comparison confirms the diagnostics are unchanged. Other reconciled TS/TSX/CJS files pass with 41 existing unused-variable warnings and zero errors. Do not describe whole-slice lint as clean. Logs: `/private/tmp/admin-follow-up-integrated-lint{,-baseline,-targeted}.log`.
- The renamed migration passes the disposable PostgreSQL 17 rehearsal: non-mutating legacy backfill, unlinked/note-only contexts, bidirectional updates, Won preservation, ownership, version conflicts, Complete/Clear history and restricted grants. Log: `/private/tmp/admin-follow-up-integrated-postgres.log`.
- Browser validation uses an isolated fixture host at `http://127.0.0.1:3227`, importing components from the active release worktree. No repository `.env` is loaded; API calls are intercepted. The first runs failed because the temporary host was missing its CSS/config convention; those are validation-host setup failures, not passes. This is automated component coverage, not mandatory user Preview acceptance or proof of authenticated production persistence.
- After repairing the temporary host, both browser scripts exited 0: modal checks at 1440×1000, 390×844 and 844×390; ContactFollowUps checks at 1440px and 390px, including delayed skeletons, failed-draft retention, save/dismissal controls, summary updates and error/retry. Logs and exit markers: `/private/tmp/admin-follow-up-integrated-{modal,contact}-browser.{log,exit}`. The host is stopped after validation; it is not another maintained product/environment.
- Production schema/configuration changes, deployment, feature enablement and production write acceptance remain unapproved and unperformed. Shared follow-ups remain default-off; existing task conversion/history is retained. Final hosted routing verification and approved backup/release/write-test scope remain open.

## Release workflow correction — November 24, 2026

- Follow the November 23 decision in `/Users/brunowong/pulse/docs/staging-and-release-workflow.md` and the related integrated release checkpoint. Those newer documents are in the active release worktree, not this worktree's older documentation snapshot.
- Persistent staging and manual Preview acceptance are **not** blanket release gates. Do not rebuild/populate staging or hold this work for staging schema parity. Local tests and focused disposable PostgreSQL rehearsals establish specific behavior; enforced read-only production checks establish actual schema/data compatibility.
- The staging investigation found missing identity prerequisites, but this is not a product-release blocker or authorization to repair staging. No remote migrations or configuration changes were performed.
- Earlier production aggregate/schema findings remain useful context, but verify the access mechanism before counting them toward the enforced-read-only compatibility gate; the continuation summary alone does not establish that enforcement.
- Next: review compatibility on the consolidated production project using enforced read-only access; prepare exact additive migration/configuration scope, backup/recovery and application rollback for explicit approval. Continuing development does not authorize production migrations, deployment, configuration changes or write tests.
- Keep shared follow-ups default-off and note-to-task conversion available until the bounded replacement release is verified and accepted. No additional permanent test school or staging product is required.

## Historical sequence — superseded, not an implementation backlog

The original sequence is retired. Follow-up notes/dates and expanded profile-adjacent email/SMS composition already exist. Task conversion is no longer gated on a replacement task-management workflow. Use the current status section at the top; shared template administration is the next distinct feature.

Leads and Contacts remain separate. Preserve Leads lifecycle tabs, including Disenrolled recovery. No dedicated Follow-ups destination or new identity-matching engine.

## Release 1: implemented locally, not deployed

- Leads displays **Enrolled** instead of **Current student**, retaining existing opportunity-origin classification.
- Contacts list/profile display recorded **Enrolled**, **Disenrolled**, **À la carte**, and **Service client** badges through one presentation helper.
- List API summarizes all student/enrollment roles already fetched, without additional queries or schema changes. Returning enrolled students do not also receive Disenrolled; at most one lesson badge plus Service client.
- Holder-only contacts do not inherit children's badges. Family headers retain existing presentation rather than implying that a parent personally enrolled.
- À la carte is recognized only when explicitly recorded in client status. No dedicated à la carte field was found during this inspection; trial attendance or missing enrollment never establishes this badge.
- Service client reuses existing non-student booking classification. No future/past booking dates or new lifecycle calculations.
- Shared Notes editor offers **@ Mention** alongside existing Cancel/Save actions. Typed `@` and button-triggered mentions share directory lookup, insertion, recipient IDs and removal behavior.
- Existing filtering/sorting remains based on existing stored status; this release does not introduce relationship filters.

## Validation and release gates

- Targeted Node regression suite, TypeScript, targeted ESLint and whitespace checks must pass before preview.
- Production build compiled and type-checked locally, but page-data collection is blocked by missing Supabase environment configuration (`supabaseUrl is required`).
- Existing live contact browser regression could not reach the Contacts table because the local app lacks Supabase configuration. Installed Chrome can launch; cached Playwright default browser versions do not match their installed binaries.
- Browser/admin preview remains required at desktop and mobile widths: badges on mixed/client/holder records, repeated staff mentions, keyboard access, notification recipient handling and editor layout.
- Confirm imported à la carte vocabulary against representative school records before claiming that all such students are classified.
- No production data writes, migrations, commits, pushes or deployment performed as part of this local slice.

## Release 2: first UI slice implemented locally, not deployed

### Confirmed rollout boundaries

- The modal appearance is approved. Reuse it rather than reopening visual design.
- Leads already has follow-up table access, filtering and sorting. Preserve and adapt those existing capabilities to shared persistence; do not rebuild or introduce a second table workflow. Add the corresponding capabilities to Contacts.
- Once connected to shared persistence, remove embedded follow-up editing forms from both the lead slidepanel and contact context/profile panel. Keep only readable follow-up information and an Add/Edit action that launches the approved modal; do not remove unrelated Notes or communications.
- Shared persistence must preserve existing follow-ups and keep them independent of inquiry Won/enrollment transitions. Reliably linked lead/contact contexts access the same record, not copied reminders.
- Initially retain one outstanding follow-up per context rather than silently expanding to multiple tasks per person. Explicit completion and ownership are part of the next functional slice, not equivalent to inquiry status or clearing a reminder.

- Reusable `FollowUpModal` now replaces the embedded lead profile date/reminder form. Profile retains a readable summary and Add/Edit actions, including from mobile Details.
- Modal uses existing permission-checked lead PATCH contract, local-noon date validation and quick picks. Failed saves retain drafts; pending saves block duplicate submission and dismissals. Clear remains clear, not task completion.
- Existing bulk and inline table editing, intake reminders, activity events and storage are unchanged.
- Existing production follow-ups are one date/note pair in inquiry payload. The subsequent local foundation slice removes automatic clearing on Won (see below); the shared schema has not been deployed.
- Contact support needs an explicit shared persistence design, including primary/CRM database identity boundaries. Do not fake shared records by duplicating payload fields onto Contacts.
- Note-to-task conversion remains available until the replacement follow-up workflow is validated; existing tasks/history are untouched.
- Next gate: resolve shared persistence, ownership, multiplicity and completion/history; implement authorized contact access and table summaries; browser/admin preview with configured local environment.

## Actual modal preview and UI review

- Read `ui-layout-rules.md`, `ui-toolbar-rules.md`, and `ui-interaction-colors.md` before preview review.
- Uses canonical Modal/Header/Body/Footer, Button, Input, Select, Textarea, FieldGrid and Notice. No parallel modal primitives or page-specific interaction colors.
- Save remains available on an empty form; attempted save explains missing date. Correcting fields clears stale errors. Form clips around the shared scrollable ModalBody so footer remains reachable on short screens.
- Added `FollowUpShowcase` to the existing Design System page. It renders the production modal with explicitly fictional, in-memory data; saves are simulated, not real follow-up persistence.
- An isolated local host at `http://127.0.0.1:3226` renders the same showcase without dashboard authentication/database configuration. Temporary host files are in `/private/tmp/pulse-follow-up-preview`; production authorization is unchanged.
- `follow-up-modal-browser.cjs` passed using installed Chrome at 1440×1000, 390×844 and 844×390: visible modal/footer, no horizontal overflow, missing-date validation, quick pick, successful save, retained failed draft, Escape and clear. Confirmed zero API calls. Screenshots: `/tmp/pulse-follow-up-modal-<width>x<height>.png`.
- This validates the standalone modal, not the full authenticated Leads integration or shared Contacts persistence. Admin has approved the modal appearance.

## Shared foundation slice — November 24, 2026 (local, gated)

- Removed automatic follow-up clearing on Won in the lead PATCH handler. Explicit follow-up updates/clear remain supported; regression coverage checks an update alongside Won.
- Added CRM-only migration `202611240005_shared_follow_ups.sql`: shared records, tenant/person/inquiry context indexes, revision snapshots, and a version-checked transaction. Cross-database primary person/membership IDs are API-verified, not assumed to have CRM foreign keys.
- One record per inquiry context plus one general contact context. Do not collapse several inquiries belonging to a person into one reminder. Existing unlinked inquiries remain inquiry-scoped; linking uses verified `person_id`, never email/name matching.
- Compatibility trigger backfills existing payload reminders and synchronizes existing intake/table/bulk edits transactionally. Contact-modal inquiry saves update the existing payload projection in the same transaction. Contacts does not receive copied reminder fields. No existing Leads table controls were rebuilt.
- Authorized contact follow-up GET/PATCH endpoints verify the primary person/tenant; inquiry reads require Leads read access and inquiry edits require Leads read/manage in addition to Contact manage. Demo requests are denied. Actor comes from authenticated membership. Conflicts return 409; failures retain the draft.
- Contact panels display date **and full reminder message** and launch the approved modal; the disabled context-panel form is removed. The existing slidepanel now receives the Contacts list's verified editing capability for follow-up actions only. Other panel sections are unchanged. Account-only headers without a person identity do not invent a person follow-up.
- Initial owner is the saving staff member when unassigned; explicit reassignment and owner display are not implemented. Complete and Clear remain distinct; revision history is retained in storage but has no history UI yet.
- Enable only after verified CRM migration and configured integration acceptance: `NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS=true` (build-time public flag). Default is off. Do not enable just because unit tests pass.
- Validation: 126 targeted tests passed; TypeScript passed. Real disposable PostgreSQL 17 checks passed for backfill, Won preservation, compatibility in both directions, version conflicts, initial ownership, complete/clear history, unchanged-payload preservation, explicit reopening and restricted grants. SQL fixture: `scripts/security/shared-follow-up-postgres.sql` (empty disposable DB only; copy migration to `/tmp/shared-follow-ups-migration.sql` inside that DB container first).
- Still outstanding: owner presentation/reassignment, full configured Leads/Contacts integration, and migration preflight against real schema/legacy data. No real database migration, deployment, commits or pushes performed. Note-to-task conversion stays until replacement acceptance.

## Contacts follow-up table and panel checks — local, gated

- Existing Contacts filters/sorts and Leads table controls are preserved. Added an optional Follow-up metadata column to Contacts' existing table preferences and a Follow-up condition to the existing filter drawer: overdue, due today, upcoming, scheduled, or none. Dates sort chronologically with missing dates last. The column opens the existing person panel; Add/Edit remains in that panel's follow-up area and opens the approved modal.
- Summary is the earliest authorized open reminder, with its message and a count when several contexts are open. Completed/cleared records do not drive the due-date filter. Family member rows keep their own summaries; account-only headers do not invent reminders.
- List enrichment uses bounded, paginated CRM queries scoped by tenant and visible person IDs. Contact-only readers do not receive inquiry reminders. Failed reads surface an error rather than claiming no follow-ups. Rollout disabled means no new CRM list read.
- Successful panel mutations update that contact's table summary immediately. Slidepanel edit capability comes from the existing authenticated Contacts response header; default stays read-only for other callers. No other slidepanel sections were changed for this slice.
- Validation: 144 targeted tests passed (including table preferences and pagination); TypeScript, targeted lint and whitespace checks passed. Existing page/panel lint has unrelated unused-variable warnings; these were not cleaned up as part of follow-ups.
- Actual ContactFollowUps component browser tests passed at 1440px and 390px with synthetic intercepted API responses: delayed skeleton/no empty flash, retained date/message, modal-only edits, failure/draft retention, pending-save controls/Escape blocking, summary callback, error/retry and verified empty state. Actual modal standalone checks also passed desktop, portrait and landscape. This is not a claim of full authenticated integration against configured primary/CRM databases.
- Browser fixture host: `/private/tmp/pulse-follow-up-preview/app/contact-follow-ups/page.jsx`; test: `scripts/security/contact-follow-up-browser.cjs`; screenshots: `/tmp/contact-follow-up-1440.png` and `/tmp/contact-follow-up-390.png`. Public rollout flag enabled only inside that isolated synthetic preview host, not the repository's environment.

## Enforced read-only production preflight — November 24, 2026 Pacific

Executed catalog and aggregate queries against Odeon production (`jbrntsxmibfldocsuslt`) through `SUPABASE_RUN_READ_ONLY_QUERY`. The endpoint reported `current_user = supabase_read_only_user` and `transaction_read_only = on`. No customer identities, reminder bodies, secrets or records were exported.

### Installed schema and data

- Production contains `people`, `tenant_memberships`, `lead_intakes.person_id`, and `contact_band_opportunity_links`; `lead_intakes.contact_id` is nullable. Identity prerequisites are already present. Their recorded migration versions differ from source filenames: `contact_band_opportunities` = `20261120024152`; `lead_person_identity` = `20261120031606`. **Do not replay the source prerequisite migrations**, especially the identity cleanup.
- `follow_ups` and `follow_up_history` are absent. The proposed production database change is only `supabase/migrations/202611240005_shared_follow_ups.sql`, after final approval and rechecking current schema state.
- All-project aggregate: 196 inquiries, 24 verified person-linked inquiries, zero missing/foreign-tenant person references. There are **42 scheduled reminders, all unlinked**; zero linked scheduled reminders and zero note-only reminders. Backfill preserves those 42 as inquiry contexts; it cannot make them appear on Contacts without verified person linking. Never match by name/email or make linking a blanket rollout prerequisite.
- Legacy reminder checks: zero invalid timestamp inputs, non-string date/note values, or notes over 12,000 characters. Recheck immediately before any approved migration because these are point-in-time counts.
- Existing inquiry triggers categorize/log inserts and stamp `updated_at` on updates. The original self-update backfill would therefore change inquiry timestamps. Replaced it locally with direct inserts into shared storage; inquiry payloads/timestamps remain untouched and the shared audit trigger still creates snapshots.
- Existing inquiry/link tables have RLS enabled and service-role-only ACLs. New shared tables/RPC remain server-only; tenant/person/actor permission checks stay in the authorized API. No browser-role grant is proposed.

### Routing and release-line boundaries

- This follow-up work is uncommitted in `/Users/brunowong/pulse-main` on `main`. The active integrated release worktree is `/Users/brunowong/pulse`, branch `release/integrated-staff-subscriptions-20261123`; its Contacts API/panels have newer changes. Reconcile this bounded follow-up slice into that line before release review; do not overwrite the newer subscription/family/UI work or deploy this older worktree wholesale. No branch/worktree/commit/push changes were made during preflight.
- `/Users/brunowong/pulse-main/.env.local` is absent. The existing `/Users/brunowong/pulse/.env.local` sets **both** `NEXT_PUBLIC_SUPABASE_URL` and `CRM_SUPABASE_URL` to `xpnygavujqmzkdmcktdm.supabase.co` (staging). These local settings are not evidence of live production routing. Neither inspected local environment sets the shared-follow-up flag.
- `scripts/security/verify-gmail-production.mjs`, invoked by `npm run build`, requires both production URL aliases to target `jbrntsxmibfldocsuslt.supabase.co` and service-key aliases to match without logging their values. This establishes the build contract, not a fresh inspection of deployed configuration. Current hosted deployment/configuration still needs read-only confirmation; tool discovery did not expose a Vercel metadata tool. Do not substitute Supabase project secrets or fetch credentials.

### Bounded release proposal — not approval to execute

1. Finish the focused local rehearsal and reconcile the feature into the active release line. Review the exact final diff/commit set, production routing/build evidence and existing Leads writers, with unrelated panel sections unchanged. No standing staging refresh or manual Preview gate.
2. Before database execution, obtain explicit approval for the exact migration on Odeon production and its recovery plan. Verify a usable backup/restore point and recovery owner; retain a private pre-change archive of affected inquiry rows and schema through the approved backup process, never repository/test fixtures. Record timestamp, migration hash, current deployment rollback target and counts. Do not claim a backup exists without checking it.
3. Keep `NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS` unset/false. Apply **only** the reviewed shared migration through tracked migration tooling, in its transaction, with bounded lock/statement waits. Recheck backfill counts, inquiry payloads/timestamps, RLS/grants, indexes, RPC/trigger installation and history counts through approved read-only access. Abort/roll back on mismatches; do not automatically retry partially reviewed changes.
4. Separately approve any application promotion/configuration enablement. The public flag is build-time and requires a new build; turning it off is not an immediate runtime kill switch. Capture the previous known-good deployment. First verify authenticated read-only rendering. Feature-off database installation is not product acceptance.
5. Any production write acceptance needs separately approved synthetic record/action scope and cleanup/recovery: verified person/inquiry context, Leads reminder → same date/message in Contact → Contact edit reflected in Leads → Won preservation → stale-version rejection → permission denial → Complete versus Clear/history. Existing 42 unlinked reminders are not suitable evidence for a linked Contact test. Agent owns technical validation; do not ask the user to debug a fictional school.
6. Roll back the application/configuration first if necessary, retaining shared records/history and compatibility triggers. Existing inquiry writers keep payloads synchronized; general-contact contexts have no legacy projection and become unavailable while the feature is off, but must not be deleted. Database rollback is a separately reviewed recovery operation, not a casual DROP/rollback script; never replay the old identity cleanup. An older application may restore old Won-clearing behavior, so review the rollback artifact and suspend that action or use a targeted forward fix rather than promise complete semantic rollback.
7. Remove note-to-task conversion only after replacement acceptance, preserving all existing tasks/history. Owner reassignment/history UI and the profile/email/template roadmap remain separate scope.

### Validation evidence

- Inspected the prior logs: 144-test targeted run, disposable PostgreSQL checks and synthetic modal/contact browser runs contain passing output. These remain limited local/synthetic evidence, not deployed workflow acceptance.
- Fresh focused run: 79 Node tests passed, zero failed; TypeScript (`--noEmit --incremental false`) and targeted ESLint exited 0. Logs: `/private/tmp/admin-follow-up-preflight-{tests,types,lint}.log`.
- Disposable PostgreSQL 17 rehearsal includes production-style timestamp trigger behavior, non-mutating backfill, both-way compatibility, Won preservation, ownership, version conflicts, complete/clear history and restricted grants. SQL fixture also covers unlinked scheduled and note-only legacy contexts without invented identities. Log: `/private/tmp/admin-follow-up-preflight-postgres.log`; rerun after any fixture/migration edit.
- No hosted database changes, production writes, environment changes, deployment, commits or pushes. Shared follow-ups remain off; note-to-task conversion remains available.

---

## Previous production rollout record (retained)

# Scoped admin release — November 25, 2026

## Approved scope

Owner approved deploying admin improvements separately to main, without calendar/Services changes.
This release starts from main a62acba3a46a12f8d51a2dfa371466ed69a74324 and includes only recorded relationship badges, staff mention entry, shared follow-up modal/persistence integration and regression evidence.
The profile/email composer, School Setup template management and note-to-task retirement are not part of this release. Notes, task history and conversion remain available.

## Production prerequisite

Only shared migration 202611240005 is installed and verified. SHA-256: 73f9116ec19a6228d8f546b0ee3c67ce5cceb6469bccf1122b586a5ff6cd6d73.
Private verified recovery and migration evidence: /Users/brunowong/odeon-private/backups/backup-Xf4538/.
Production postflight: 196 unchanged inquiries, 1,596 unchanged lead events, 42 open unlinked reminders and 42 history snapshots. No guessed identity linking.

## Isolation and checks

- No release-branch merge: its six commits include 153 unrelated paths. None are included wholesale.
- Calendar and Services migrations, code and in-progress working files excluded. Their integration-worktree file hashes remained unchanged before commit.
- Existing main worktree held the original bounded admin patch; retained that patch, updating only installed migration version/ACL correction and its PostgreSQL rehearsal.
- Shared-file review/verified archives and full-ref bundle: /Users/brunowong/pulse-backups/admin-scoped-deploy-20261125-000358.
- Scoped TypeScript passed. Forty focused Node tests passed. PostgreSQL service/browser roles, destructive-default ACL refusal and failed-migration atomicity passed.
- Modal browser checks passed 1440x1000, 390x844, 844x390; Contact follow-up browser checks passed 1440px and 390px. Synthetic intercepted APIs only; no real sends/writes.
- Full scoped suite: 1,071 pass, 17 fail; pristine-main comparison reproduced every failure (plus an archive-only website fixture path failure). No new full-suite failures. Existing failures are Gmail fixture dependency mocks and brand-color assertions, not claimed passed.
- Targeted UI/API lint: zero errors, existing warnings. Leads route has previously recorded baseline lint errors; no unrelated lint cleanup.

## Deployment and recovery boundary

Enable NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS only for the approved production release build. Public flag is build-time, not an immediate runtime switch.
Capture deployment/commit/alias evidence after build. Read-only production checks first; no production synthetic write test or messaging authorized by this deployment request.
Previous production deployment dpl_F6wDP3i8bvDZ7cbDEjWKN5UNWWE9 has old Won-clearing semantics: not a semantic rollback guarantee. Preserve shared tables/history and compatibility triggers; no automatic DROP/full-database restore. A rollback needs Won operations suspended or a reviewed forward fix.
The calendar/Services line must later reconcile this main commit rather than replacing shared files wholesale. It retains newer subscription/family/Notes behavior independently; this scoped release neither deletes nor promotes that work.
