# Gmail sent-email outreach capture

This is a server-side Odeon integration, not a snippet or extension installed inside Gmail. Send email normally; Odeon polls the Google mailbox, matches leads, and records notes with optional status updates.

This works for Google-hosted mailboxes accessed in Gmail or Outlook. There is no Microsoft connector. Outlook must actually save/send mail to the Google mailbox's Sent folder; verify this with a test email.

## Database environments

Lead/contact data now lives in the same Supabase project as the rest of Odeon. There is no separate CRM database to deploy this feature to.

- **Odeon production:** `jbrntsxmibfldocsuslt`, the consolidated destination recorded in the October 6, 2026 cutover log.
- **Odeon staging:** `xpnygavujqmzkdmcktdm`, identified by the local Supabase project link and staging scripts. Local development configuration was checked on October 15, 2026 and points both database clients here.
- The code still uses the legacy `crmSupabaseAdmin` client and `CRM_SUPABASE_*` variable names. In each deployment, `CRM_SUPABASE_URL` must match `NEXT_PUBLIC_SUPABASE_URL`, and `CRM_SUPABASE_SERVICE_ROLE_KEY` must match that environment's `SUPABASE_SERVICE_ROLE_KEY`. These are compatibility names, not a separate project. Never mix staging and production credentials.
- Local configuration is not proof of hosted deployment settings or installed schema. Verify the target project and existing Gmail schema before applying SQL. Do not use the frozen former CRM project.

## Deployment status and prerequisites

Outbound capture is released independently of unrelated Content Studio/community work. Staging migration `20261015204044` and production migration `20261016165952` are installed as `gmail_outreach`. Production RLS and service-role-only access were verified. The operator connected admin, ran the manual test, and reported success. Pre-release metadata confirmed one receipt, a completed sync, and no connection error. This release enables authenticated polling every five minutes and publishes the Twilio-style Gmail card. Sending email, incoming replies, and a unified Conversations inbox are not included.

1. The migration passed a disposable PostgreSQL rehearsal and was installed in staging before the explicitly approved production pilot. A separate staging mailbox was intentionally not required. The historical `crm-consolidation` directory name does not target the retired CRM project. The SQL is not rerunnable; inspect existing objects and history before any future application. For an application rollback, stop syncing and revert deployment rather than deleting retained notes/receipts.
2. Enable Gmail API in the Google Cloud project and configure the OAuth consent screen. Request only `https://www.googleapis.com/auth/gmail.readonly`. This is a restricted scope: review Google verification and security-assessment requirements for your audience. Use an internal app only if eligible; external Testing-mode Gmail refresh tokens expire after seven days, so do not leave an unattended production integration in Testing.
3. Create a web OAuth client with the exact authorized redirect URI `https://YOUR_PULSE_HOST/api/gmail/callback`. Use the matching staging or production app origin; keep credentials and callbacks environment-scoped.
4. Configure server environment variables (never expose through `NEXT_PUBLIC_*`):
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `PULSE_APP_URL` — canonical HTTPS origin
   - `GMAIL_TOKEN_ENCRYPTION_KEY` — 32 random bytes encoded in base64; generate with `openssl rand -base64 32`. Back up securely; losing/changing the key requires mailbox reconnection.
   - `CRON_SECRET` — at least 32 random characters, generated specifically for production. Store the same key in Supabase Vault as `odeon_gmail_sync_secret`. Supabase sends a short-lived HMAC signature, never the key itself, through the HTTP queue. Do not expose it through a public variable or URL. `GMAIL_SYNC_SECRET` remains supported; if both are present, they must match.
5. Supabase `pg_cron` calls authenticated `GET /api/internal/gmail-sync` every five minutes through `pg_net`; Vercel has no cron configuration. The endpoint processes up to five mailboxes per call, one page of 50 sent messages per mailbox. Timing is approximate, not real time. Keep staging scheduling disabled. Unscheduling the database job stops automatic capture; manual Sync remains available. The production build guard continues requiring the worker authentication key.
6. Under Settings → Integrations, connect each office Google mailbox. Users need `communications.configure` and `leads.manage` (Owners bypass these checks). The worker revalidates the configuring membership before each sync.
7. For additional mailboxes, explain mailbox-wide consent before connection. Use a synthetic inquiry and verify the dated quoted note and conservative status update, then repeat Sync to verify no duplicate. Check ambiguous matches/review before expanding. The initial admin pilot was accepted by the operator before automatic polling was enabled.

## Behavior and safeguards

- Capture begins at initial connection time; no historical import. Reauthorizing an existing connection preserves its original start time. Disconnect deletes the connection row; connecting again afterward establishes a new capture start time.
- Gmail read-only access is mailbox-wide, but only Sent messages are queried. The worker requests each candidate Sent message with `format=full` before checking recipient matches, so nonmatching email content can pass through the application server even though it is not persisted. Separate attachment download requests are not made, and attachment parts are excluded from captured note text.
- Matching uses exact lead/contact email and explicit email fields (`email`, `parent_email`, `guardian_email`, `account_holder_email`) in the inquiry payload. Names are never fuzzy-matched. More than one matching inquiry goes to review. Recipient sets larger than five are skipped as bulk outreach.
- Primary and family addresses stored elsewhere are not yet joined: missing matches must be corrected on the inquiry/contact or supported in a later integration.
- Only new/contacted/booked inquiries are considered. Notes never downgrade or advance leads to enrolled/won/lost. Manual automation pauses are honored.
- Booking detection is an English-only regex heuristic: a confirmation phrase must be immediately followed by a supported day/date and a valid 12-hour AM/PM time, with only supported connectors such as “for” and “at”. Unrelated sentences or office hours cannot supply missing evidence. Recognized tentative/cancellation/question wording anywhere in the body prevents booking. This is not semantic understanding or calendar validation; unsupported wording remains Contacted, and dates are not checked for calendar validity or whether they are in the future. Validate representative office emails in staging before enabling automatic Booked transitions in production.
- Plain text preferred; HTML is converted to text. Known reply/signature markers are removed conservatively, but arbitrary signatures and all quoted HTML variants cannot be identified reliably. No HTML is rendered. Up to 12,000 text characters are quoted.
- Gmail Message-ID is the tenant-wide dedup key, falling back to mailbox + provider message ID. Note insertion, receipt resolution and status change are one transaction in the environment's Odeon database. A sync lease avoids concurrent workers on one mailbox; overlapping windows and retained cursors retry failed batches.
- Tokens are AES-256-GCM encrypted server-side and unavailable to browser clients. Tables have RLS with no anon/authenticated grants. Service-role-only functions validate tenant and candidate lead IDs.
- Captured notes show “Email sync” rather than impersonating a staff member. Sender and provider identifiers remain in event metadata.
- Disconnect deletes the connection row and its stored refresh token. Existing outreach receipts and lead notes remain; revoke Pulse in the Google account to revoke the provider grant. Ignoring a review clears that receipt’s body, but successfully recording outreach retains its body in the receipt as well as quoted text in the lead note. Define retention for unresolved reviews, recorded receipts, lead notes, and status-event evidence before broad deployment; automatic retention cleanup is not implemented.

## Local database rehearsal

Run `node /Users/brunowong/pulse/scripts/security/gmail-database-rehearsal.cjs` with Docker running. This creates a disposable PostgreSQL 17 container with no published ports and networking disabled, installs a synthetic lead schema and the Gmail migration, and checks database permissions, tenant isolation, leases, deduplication, atomic rollback, status guards, and disconnect retention. It never loads environment files or connects to Supabase, and removes its container afterward. The PostgreSQL image may need downloading. This is not proof that the schema is installed or compatible with all hosted triggers.

Local configuration targets staging and has Google credentials and local encryption/scheduler secrets. Production uses the approved Google OAuth client with callback `https://app.headlinerma.com/api/gmail/callback` and a separate encryption key. Its owner-only backup is outside the repository at `/Users/brunowong/.config/odeon/gmail-production-key`; move it into secure organizational backup. Never copy local database credentials or encryption keys into production. Production secrets are unreadable through Vercel CLI; the production build verifies database targets, service-key alias alignment, canonical origin, OAuth/encryption settings and strong cron authentication without logging values.

## Rollout limitations

## Supabase scheduler operations

Production-only support SQL: `/Users/brunowong/pulse-gmail-release/supabase/gmail-scheduler.sql`. It enables `pg_cron`/`pg_net`, installs an admin-only dispatcher, and temporarily installs a service-role-only secret-provisioning RPC. Provision from the owner-only local key backup without logging values, then immediately drop `public.configure_gmail_scheduler_secret(text)` and reload the PostgREST schema. Never commit secret-bearing SQL. The key is stored encrypted in Vault; privileged database administrators can access it.

After deploying and verifying the worker, apply `/Users/brunowong/pulse-gmail-release/supabase/gmail-scheduler-enable.sql`. It schedules `odeon-gmail-sync` every five minutes and a daily seven-day cleanup restricted to these two jobs' run history. Rollback commands are included in that file. No email retention cleanup is introduced.

The dispatcher signs `gmail-sync:<Unix seconds>` using HMAC-SHA256. The worker accepts timestamps within two minutes of server time, validates signatures with constant-time comparison and retains bearer compatibility for operator checks. Queue-visible signatures expire; replay within the short window is still possible for privileged queue readers. Existing mailbox leases and receipt deduplication protect against duplicate capture. The HTTP timeout is three minutes; the worker allows up to five 30-second mailbox batches.

Monitor `cron.job` and `cron.job_run_details` for timer failures, then `net._http_response` for actual HTTP status, timeout/error and JSON `synced`/`failed` counters. Cron success alone only confirms dispatch. Check `gmail_connections.last_synced_at` and presence of `last_error` without selecting tokens or email bodies. `pg_net` response retention defaults to six hours; job history is pruned after seven days. There is no external alerting configured. Repeated HTTP errors or mailbox failures require investigation; Sync now remains available.

Existing Supabase/Vercel quotas still apply (288 worker calls/day at five-minute intervals); no plan upgrade is performed. Free-project pausing and Vercel Hobby commercial-use eligibility remain separate operational concerns.

Consent-screen audience/verification, retention decisions, and broader booking false-positive acceptance remain operational tasks. Google Cloud consent-screen publishing status has not been verified by the agent. The operator authorized the admin mailbox and accepted the manual capture test. Production scheduling uses the existing consent; no extra Gmail permissions are requested. Monitor last sync/error metadata after deployment. Booking stays an English heuristic, not Opus booking validation, and email bodies retained in notes/receipts have no automated cleanup.