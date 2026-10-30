# M0 — Repository-based readiness assessment

**Checked:** October 26, 2026\
**Method:** local source/document inspection, secret-safe local configuration classification, synthetic local tests. No hosted queries, deployments, provider calls or database writes.\
**Conclusion:** ready for focused domain design and synthetic implementation planning; **not certified for real-data shadow beta or financial cutover**.

## 1. Environment evidence

- Both URL entries in `/Users/brunowong/pulse/.env.local` currently match the known staging project used by `/Users/brunowong/pulse/scripts/staging/seed-users.cjs`; the main and CRM URL strings are equal. This supersedes the October 7 document's warning **for this local file only**.
- Both service-role key entries are configured; their values were not printed or their validity tested.
- Local Twilio account/token, Anthropic API and Stripe secret key entries checked by name were unset. This does not inventory all provider credentials, shell/deployment variables or stored connections.
- `/Users/brunowong/pulse/lib/supabase/admin.ts` and `/Users/brunowong/pulse/lib/supabase/crm-admin.ts` create service-role clients from environment variables. These clients do not themselves enforce a shadow-mode write barrier.
- `/Users/brunowong/pulse/app/api/inbox/reply/route.ts` obtains Twilio credentials from `twilio_config`. Missing local Twilio variables cannot establish no-send safety.
- `/Users/brunowong/pulse/app/api/communications/email/route.ts` can use a shared mailbox connection to send externally. Mailbox grants and stored credentials require separate inventory.
- `/Users/brunowong/pulse/scripts/security/verify-gmail-production.mjs` checks selected production configuration at build time; it is not a general staging/shadow safety check.

**Unverified:** hosted project state and data, Auth/storage policies, deployed variables, scheduled jobs, callback destinations, provider rows, mailbox grants and actual outbound isolation. No secret values were recorded.

## 2. Existing staging tools are useful but narrower than shadow beta

| Evidence | What it establishes | What it does not establish |
|---|---|---|
| `/Users/brunowong/pulse/scripts/staging/seed-users.cjs` | Exact staging URL guard; synthetic owner/admin/staff/assistant identities; checks for provider configuration | Full integration denial; actual hosted configuration; parent/student access |
| `/Users/brunowong/pulse/scripts/staging/sanitize-snapshot.cjs` | Selected table transformations and relationship remapping | Full operational snapshot; proof all future fields are sanitized; real-data shadow lifecycle |
| `/Users/brunowong/pulse/scripts/staging/refresh-sql.cjs` | Transactional selected-table replacement, isolation checks, no cascading deletion, typed comparison | Non-destructive baseline refresh/rebase; compatibility with persistent shadow changes |
| `/Users/brunowong/pulse/scripts/staging/rehearse-refresh.cjs` | Existing disposable-database rehearsal script | A current successful rehearsal; its private prerequisites were not read or executed here |
| `/Users/brunowong/pulse/scripts/staging/prepare-refresh.cjs` | Production-read preparation tool with explicit source guard and private output | A tool to run against current staging; its production source guard should not be bypassed |

The selected snapshot table list covers accounts, people, students, contacts/CRM, leads/events, messages and notes/replies. It **omits enrollments, scheduling, attendance-as-a-domain and financial ledgers**. API pagination is not a transaction-wide snapshot. Per-refresh salted ID remapping is unsuitable as a stable incremental identity bridge across independent refreshes.

The refresh SQL deletes/replaces selected operational records, rejects Auth users, and can fail on additional foreign-key dependents. Do not repurpose it as a persistent beta refresh or run it to find out whether a real-data environment is compatible.

## 3. Domain and import evidence

### Reusable foundations

- People/students/instructors and tenant memberships exist in current API usage. Exact hosted constraints still require inventory.
- Shared authorization helpers, lead history, communication checks, account audit and funding workflow structures provide useful patterns.
- `/Users/brunowong/pulse/scripts/migration-024-account-people-of-contact.sql` defines account contacts and funding-case contact links, not a complete household/guardian/portal model.
- `/Users/brunowong/pulse/docs/crm-consolidation-inventory.md` records the completed October 6 CRM cutover. Consolidated storage does not establish canonical CRM/person identity links.

### Specific blockers before authoritative multi-enrollment/import use

- `/Users/brunowong/pulse/app/api/contacts/route.ts` flattens the first enrollment and queries an existing enrollment with `.single()` per student during import.
- `/Users/brunowong/pulse/app/api/contacts/[id]/route.ts` contains single-enrollment editing assumptions and an instructor reference different from current read/import paths.
- Attendance in enrollment custom fields is merged by date, which cannot distinguish same-day sessions. No source session identity in the reviewed attendance entry type.
- Some import writes do not inspect returned errors, and a tenant sync timestamp can be updated without proving a complete accepted import. It is not a source-coverage or reconciliation certificate.
- Monthly roster snapshots are optional in code and are not session-level delivered-service records.
- `/Users/brunowong/pulse/app/api/insights/route.ts` computes signals from imported data and first-enrollment context, caches generated cards and provides no baseline/scenario separation. Defer operational reliance on Highlights.
- `/Users/brunowong/pulse/docs/charterflow-domain-alignment.md` explicitly identifies incomplete first-class responsibility allocations and payment-event accounting.

### Migration baseline

Numbered SQL files under `/Users/brunowong/pulse/scripts/` coexist with timestamped migrations under `/Users/brunowong/pulse/supabase/migrations/` and CRM migration scripts. Historical files assume structures current code treats as optional or absent. A file inventory is not evidence of applied migration state. Do not execute all files in order as an environment bootstrap.

## 4. Evidence still required

1. Approved hosted schema/constraint/migration inventory, with no customer record dump into Git.
2. Approved source-export sample or schema: stable student, subscription and session IDs, date coverage, history, deleted/corrected records and financial fields.
3. Actual Headliner workflow walkthrough, including processes outside Opus and current Odeon ownership.
4. Isolated rehearsal database and tested recovery for the pilot schema; verify privileged and browser access boundaries.
5. Negative integration tests: attempted sends, payments, calendar writes, callbacks and scheduled jobs fail closed in shadow.
6. Definition of baseline refresh and scenario preservation before introducing real-data beta.

## 5. Local validation record

- Node synthetic tests: **87 passed**, zero failed/skipped. Suites: staging user-target guards, snapshot sanitization, fictional names, lead-comment fixtures and tenant selection.
- TypeScript: `tsc --noEmit --incremental false --pretty false` passed.
- `git diff --check` passed.
- Reading-copy HTML navigation and section checks passed; PDF verification is included in the completion report.

Synthetic test success demonstrates only tested local behavior; it does not approve hosted refresh, real-data beta or cutover. No external verification scripts, snapshot preparation, user seeding, database refresh or private-backup rehearsal were run during this assessment.