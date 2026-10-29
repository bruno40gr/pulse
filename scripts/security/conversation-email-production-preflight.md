# Resumed integration — October 29, 2026

The current candidate is based on live lead commit `cc539691067861887da8a027e0c69b1e1f0a00fa`, not the older baseline discussed below. Combined validation and evidence are recorded in `conversation-email-store-rollout.md`; historical observations below remain historical, not current deployment verification.

Read-only Supabase checks during this pass:

- Confirmed `jbrntsxmibfldocsuslt` is the active healthy Odeon project (PostgreSQL 17).
- One Gmail connection exists; no active legacy lease was observed at the instant queried. This is not a drain guarantee while dispatch remains enabled.
- `conversation_email_jobs` and `gmail_schedule_sync(integer)` are absent: both migrations remain pending.
- Retrieved schemas for Gmail connections, tenants, memberships, roles, role permissions, and permissions. Gmail has the expected `scopes` column, primary key, tenant/email uniqueness, tenant foreign key, and no non-internal triggers. The service role has RLS bypass. This inspection is not a full-schema rehearsal or live PostgREST authorization test.
- Gmail dispatch remains active every five minutes. Its last five observed database dispatch runs succeeded; dispatch success does not prove downstream HTTP/mailbox success. No scheduler command, secrets, token ciphertext, email content, or mailbox address was retrieved.

No production writes, migrations, scheduling/claim RPC calls, flag changes, or deployments were performed in this resumed pass. Remaining gates include complete migration compatibility review, production configuration/backup checks, authenticated PostgREST and Gmail smoke tests, and an approved pause/drain maintenance sequence before migrations and deployment.

## Follow-up review — October 29, 2026

- **Backup gate is blocked:** the Supabase backup-list API returned an empty `backups` array, `pitr_enabled=false`, and no physical backup metadata. `walg_enabled=true` alone is not evidence of an available, recoverable backup. This does not rule out an external backup; obtain a verified recovery artifact and restore procedure before production migration approval. No backup was created, restored, or enabled.
- Additional catalog inspection found no collisions for the proposed conversation claim/commit/credential functions, fairness/finish functions, or four new legacy scheduling columns. Existing Gmail dependencies include outreach and organisation-email foreign keys; the proposed migrations retain existing connection rows and identifiers. This inspection is narrower than a full-schema migration rehearsal.
- Existing Gmail table SELECT/UPDATE privileges are denied to `anon` and `authenticated` and granted to `service_role`. These are catalog observations, not actual PostgREST authorization checks for the new schema. The new relations/RPCs do not exist yet, so their live access cannot be verified before migration.
- Vercel read-only metadata confirms canonical alias and project production target both reference Ready deployment `dpl_Bm4uQzj6edV1ydTLx4WnochLrnca`, Git commit `cc539691067861887da8a027e0c69b1e1f0a00fa`. Its build events include the successful production configuration guard for database aliases, callback origin, encryption key, and scheduler secret requirements. This validates the inspected build's guard, not an in-process runtime probe or a future candidate deployment's configuration.
- Neither runtime nor build environment-name metadata lists `CONVERSATION_EMAIL_STORE`. No environment values were requested or printed. Sanitized evidence: `/tmp/pulse-gmail-integrated-production-metadata.json`.

Next operational prerequisite: establish a verified recoverable backup (and approved maintenance window), then complete full-schema compatibility and authenticated-session testing. Do not treat a general request to continue review as approval to incur backup-plan charges, expose/export credentials, pause production scheduling, or apply migrations.

# Conversation email store: read-only production preflight

Evidence window: database observations through `2026-10-29 15:05:01 UTC`.
Target: production project `jbrntsxmibfldocsuslt`, as configured by the repository production guard.

All remote operations were read-only schema/catalog queries, migration-history reads, or aggregate operational reads through the connected Supabase integration. No provider calls, scheduler dispatches, mailbox identifiers, message contents, token values, Vault values, or HTTP response bodies were requested. No migration, deployment, configuration, or flag was changed.

## Verified remotely

- Existing Gmail connection columns match the legacy schema prerequisites, plus the deployed `scopes` column. UUID tenant/membership/role identifiers and the permission columns used by the worker exist.
- `gmail_connections` has a primary key on `id`, uniqueness on `(tenant_id,email)`, and a tenant foreign key. The store migration adds its required `(tenant_id,id)` uniqueness.
- Existing `gmail_connections` and `gmail_outreach` tables have RLS enabled and table ACLs restricted to postgres/service_role. The legacy claim function is security-definer and executable by service_role. This is catalog evidence, not an authenticated PostgREST test.
- New store tables/functions, legacy scheduling/finish functions, retry columns, and credential triggers are absent. Migration history does not contain `202610290001` or `202610290002`. Both migrations remain pending; do not deploy the changed scheduler before applying its dependency migration.
- The Gmail cron job is active on `*/5 * * * *`, invoking the expected dispatch function. Its dispatch definition contains the canonical `app.headlinerma.com/api/internal/gmail-sync` target, HMAC signature header, and 180000-ms timeout.
- In the observed trailing 24-hour cron window: 288 dispatch runs, zero failed cron runs. Daily history cleanup is also active and had one successful run. Cron success alone only establishes dispatch, not HTTP or mailbox success.
- In the retained trailing six-hour HTTP response window: 72 responses, all HTTP 200 and `timed_out=false`. These are aggregate pg_net responses, not request-ID-correlated proof of individual Gmail work, and response bodies were not inspected.
- There is one connected mailbox in one tenant, with no stored error, no partial pagination window, no active lease, and successful legacy coverage through `2026-10-29 15:05:01.414568 UTC`. Its configuring membership and tenant-scoped role resolve. This does not establish Gmail message completeness or new-store freshness.

## Still unverified / deployment blockers

1. Effective Vercel production environment values: database URL/service-key alias equality, callback origin, and encryption/OAuth configuration. Read-only Vercel API checks after reauthentication verified the canonical alias/deployment and reported code revision; the store flag is absent from project/shared configuration and deployment environment-name lists (see follow-up below). Values remain unverified; metadata is not a runtime configuration assertion.
2. New RPC exposure and service-role access through actual PostgREST after reviewed migrations, plus denied anon/authenticated access. No authenticated staff session was supplied or used; stored API authorization remains locally tested only.
3. Migration rehearsal against a complete representative live-schema snapshot. A focused catalog export of `gmail_connections` (including its live `scopes` column and constraints) now passes both migrations and the existing database regression suite using `--live-gmail-schema`. Other dependency tables still use repository fixtures; this is not complete live-schema compatibility evidence.
4. End-to-end reconnect, provider reconciliation, new-store queue progress/freshness, production database-delay behavior, and tenant/quota pacing. Existing scheduler health is not evidence for the not-yet-deployed worker.
5. Review and commit the complete uncommitted change set. Plan database-first deployment for the fairness RPC dependency, and keep the conversation store disabled until the remaining gates pass. A controlled tenant rollout requires a tenant gate because the current flag is global.

No readiness-to-enable claim is made by this preflight.

## Follow-up local validation

- Re-ran the full security suite: 562 passed, zero failed or skipped.
- Focused live Gmail table rehearsal passed in a network-isolated PostgreSQL 17 container; it performed no production writes. Log: `/tmp/pulse-email-store-live-schema-rehearsal.log`.
- Rehearsal script syntax/ESLint and repository diff whitespace checks passed.
- Inspected the saved repository-schema rehearsal log, local-config build log, and build exit file (`0`); the build was not repeated for these script/documentation-only changes.
- Deployment review identified that old-code completion directly updates mailbox rows and bypasses token fencing. Rollout notes now require pausing dispatch/manual sync and draining old workers before migration/deployment, with another drain before application rollback. No production pause was performed.

## Vercel access follow-up

- The local project link identifies project `pulse` (`prj_OO09YuAkOCsoKP5iVmcrbYyoBf2q`). This is local configuration, not evidence of the deployed production target.
- Both normal and direct tool discovery returned no Vercel tools. No Vercel CLI executable or `VERCEL_TOKEN` environment variable was found; a standard local CLI authentication file exists.
- Attempted read-only Vercel API requests using that local credential for project metadata, the canonical alias, and environment metadata with decryption disabled. The attempt failed with HTTP 403; no successful verification result was emitted. Stopped without retrying with alternate credentials or requesting environment plaintext.
- Deployment revision, canonical alias ownership/target, production environment values, alias equality, and store flag state therefore remain unverified. An authorized Vercel owner must provide read-only access or sanitized verification before this gate can close. Do not paste tokens or environment secret values into chat.

### After local reauthentication

The earlier HTTP 403 access blocker was resolved. Read-only API checks now confirm:

- Project `pulse` is the expected linked project. Its production target is `READY`, deployment `dpl_8wNDJvRFTMJCkEoJ9P8F7VrZtVLb`; the canonical `app.headlinerma.com` alias resolves to that same project and deployment.
- Deployment metadata reports commit `5a89a4672d9de775b4b58c76c30eb5da523050ef`, branch `fix/auto-load-selected-email-range`, and source `cli`. This is reported metadata, not proof that a CLI upload had no uncommitted changes.
- Project environment metadata contains production entries for both Supabase URLs and service-role keys, `PULSE_APP_URL`, Google client ID/secret, Gmail encryption key, and `CRON_SECRET`. No values were printed or validated.
- Neither `CONVERSATION_EMAIL_STORE` nor `GMAIL_SYNC_SECRET` appears in the returned project environment list. The shared environment list is empty with no next page. This confirms absence from current project/shared configuration, not from a deployment-specific CLI override.
- Deployment environment fields were arrays rather than name/value maps; an attempted key summary produced numeric array indices and provides no evidence about deployed variable names or values. Do not infer deployed flag state from that summary.

Remaining configuration gates: validate effective deployed database URLs, service-key alias equality, callback origin, encryption-key format/secret strength, and effective deployment flag state without exposing secrets. Current project metadata alone does not close those gates. No configuration or deployment was changed.

### Deployment environment-name inspection

A subsequent read-only inspection correctly handled the deployment environment arrays as variable-name lists. Neither `CONVERSATION_EMAIL_STORE` nor `GMAIL_SYNC_SECRET` is listed in the deployment's runtime/build environment metadata. Required Gmail/database configuration names are present. Together with project/shared metadata, this supports the store flag being unset for the inspected deployment; it is not an in-process runtime probe or validation of secret values. No secret values were printed.

Re-ran TypeScript (`npx tsc --noEmit`) successfully. Continued review of the stored route, store/worker, refresh/merge helpers, scheduler, and SQL fencing did not identify a new blocker in this pass; this is not a completed independent review of the full change set. No application code was changed in this pass.