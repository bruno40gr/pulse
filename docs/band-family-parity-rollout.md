# Band drafts and family management — local implementation, November 20, 2026

## Family modals and focused contact editor — live

Deployment `dpl_1oLVrR9SiLeeGZEMdVpTHP8fdPEq` is READY and verified as serving
`app.headlinerma.com`, superseding the inline family release below. Add student
and Manage account holders now use the existing-band modal frame: shared Modal,
fixed layout, lg size, header/body/footer and shared participant picker.
Editing replaces profile chrome with an Edit Contact header and Save/Cancel;
communication controls, section tabs and duplicate edit action are hidden.
Backdrop/Escape do not leave editing; explicit close uses discard confirmation.
Mobile header actions wrap. Family mutations still persist immediately and are
not rolled back by contact-details Cancel.

Snapshot `/private/tmp/pulse-modal-editor-release-20261120` is layered from
`/private/tmp/pulse-family-inline-release-20261120` (parent deployment
`dpl_DUPmgmhufSyyF2H8gKM2WRMCdRcQ`), not dirty HEAD. Exact six-file SHA-256
allowlist: `modal-editor-release-files.json`. Isolated TypeScript, targeted lint
and 197 family/picker/loading/lead tests passed. Synthetic browser workflows at
1440px/390px cover modal close/Escape, retained drafts, student creation, focused
editor chrome and Save/Cancel. Desktop/mobile screenshots reviewed locally.
Production build/configuration guard passed. Canonical smoke: contacts 307 to
login; family GET/POST and lead count GET 401. Lead-count correction retained.
Evidence: `/tmp/pulse-modal-editor-deploy.{log,exit}`,
`/tmp/pulse-modal-editor-canonical-inspect.log`,
`/tmp/pulse-modal-editor-canonical-smoke.json`.
No migration, customer edits, sends, git commit or push. Authenticated staff
acceptance remains outstanding. Documentation updates are checkout-only.


## Inline family flows — live

Deployment `dpl_DUPmgmhufSyyF2H8gKM2WRMCdRcQ` is READY and verified as serving
`app.headlinerma.com`. This supersedes the family hierarchy release below.
Add student and Manage account holders now reveal mutually exclusive borderless
forms below the persistent family heading/student list, with matching spacing,
Cancel actions and retained drafts. No separate add-student view or nested cards.
Shared participant results retain their scroll limit without fixed blank height.

Snapshot `/private/tmp/pulse-family-inline-release-20261120` is layered from the
previous production snapshot `/private/tmp/pulse-family-hierarchy-release-20261120`
(`dpl_A6kFBktfFPxDqP1gjjbL6gzN6abu`), not dirty HEAD. Exact six-file hash allowlist:
`family-inline-release-files.json`. Isolated TypeScript, targeted lint and 192
family/picker/lead tests passed. Both existing/new contact states were reviewed at
1440px/390px; browser workflows verify inline visibility, cancellation, switching,
draft retention and student creation using intercepted API IO.
Production build/configuration guard passed; canonical contacts redirects 307 to
login, family GET/POST and lead count GET return 401. Lead-count correction retained.
Evidence: `/tmp/pulse-family-inline-deploy.{log,exit}`,
`/tmp/pulse-inline-canonical-inspect.log`, `/tmp/pulse-inline-canonical-smoke.json`.
No migration, customer record edits, sends, git commit or push. Authenticated staff
acceptance remains outstanding. This documentation update is checkout-only.


## Family hierarchy correction — live

Deployment `dpl_A6kFBktfFPxDqP1gjjbL6gzN6abu` is READY and verified as serving
`app.headlinerma.com`, superseding the lead-count deployment while retaining its
notification semantics. Manage Family Group has Add student and Manage account
holders header actions, compact student rows with shared PersonName/OverflowMenu,
and account-holder radios/picker revealed only on request. Student row names are
no longer H2 headings. Existing confirmation and primary-account protections remain.

Release snapshot: `/private/tmp/pulse-family-hierarchy-release-20261120`, layered
from `/private/tmp/pulse-lead-count-release-20261120` (deployment
`dpl_42XfJHizodLFFC75n61cHhycgU1g`), not dirty HEAD. Exact six-file SHA-256 allowlist:
`family-hierarchy-release-files.json`. Isolated TypeScript and 192 family/picker/lead
tests passed; targeted lint and intercepted browser workflows at 1440px/390px
passed, with both screenshots reviewed. Production build/configuration guard passed.
Canonical smoke: contacts 307 to login; family GET/POST and lead count GET 401.
Evidence: `/tmp/pulse-family-hierarchy-deploy.{log,exit}`,
`/tmp/pulse-family-canonical-inspect.log`, `/tmp/pulse-family-canonical-smoke.json`.
No migration, customer relationship edits, sends, git commit or push. Genuine staff
acceptance remains unperformed. Documentation updated checkout-only after deployment.


## Account-manager UX follow-up — deployed

Production deployment `dpl_8osQRZJWdjMW99SELaegEPUbggjo` is READY and verified
as the deployment serving `app.headlinerma.com`. Vercel's production build and
configuration guard passed. Canonical unauthenticated smoke checks: contacts
page returns 307 to login; family GET/POST return 401. This supersedes the
previous deployment below. Follow-up documents were updated after deployment.

User authorized live deployment of the corrected account-oriented flow. Snapshot:
`/private/tmp/pulse-account-manager-release-20261120`, based on the previously
deployed snapshot (not dirty HEAD), with 15 follow-up files and SHA-256 hashes in
`followup-release-files.json`. Unrelated audit/email/cache changes are excluded.

Managers now link people directly to existing `account_holders`, without choosing
a dependent or creating another account. The service-only transactional function
`change_account_manager` was applied on Odeon and recorded as migration
`202611210005`; anon/authenticated execution is denied. Primary-holder deletion
is blocked, and student accounts, payment data and routing are not modified by
this writer. No customer relationship edits or sends were made during rollout.

Also included: shared event participant search for family additions, visible
existing/new choices, current account names in student results, Add student by
the dependent count, H2 dependent names, table-row-only search loading, removal
of explanatory boilerplate, and mouse-only focus outline suppression (keyboard
focus remains visible). Multiple-account student exceptions remain possible.

Validation: isolated snapshot TypeScript and 50 focused regressions passed;
targeted lint passed with two pre-existing contacts-page warnings. Disposable
PostgreSQL checks cover account-manager idempotency, foreign-tenant rejection,
creation without extra accounts, removal and primary protection. Intercepted
browser workflows passed at 1440px and 390px. Genuine staff acceptance remains
unperformed. Deployment completion and canonical smoke checks are recorded below
when confirmed. No git commit or push was performed.

## Current status — deployed following explicit user authorization

Supersedes the historical not-deployed/approval-pending statements below for this
specific release. Production deployment `dpl_6GvYhFtMfWebA5b4KCBD38eR74mJ`
was built from `/private/tmp/pulse-band-family-release-20261120` and promoted to
the Pulse production domain. The snapshot starts at base commit `777eaa1` and
overlays only the band/family allowlist in its `release-files.json`. It excludes
unrelated dirty audit/email/cache patches and preserves HEAD's band-write gate.
This is a CLI source deployment, **not** a commit of the dirty working tree.

Reassessment: existing account/profile editing and direct primary account_id
assignment predate Beta. The live family-management controls were nevertheless
disabled. The added family function reuses accounts/people/students/student_accounts;
it does not replace those tables or migrate household identities. Its additions
provide atomic dependent creation, revision/retry protection and suppression of
new additional-account messaging. Draft persistence is a separate band requirement.

Applied production additions: coach_person_id, description, band_creation_drafts
and its RPC; communication_enabled, family_revision, contact_family_operations
and its RPC. Existing links retain communication behavior. New tables have RLS;
anonymous/authenticated direct table SELECT and RPC EXECUTE are denied, service
role access verified. No customer relationships, billing, portal access or Tallman
records were changed by the rollout.

The migration runner assigned the same second-based history version to parallel
requests: family history succeeded, band history insertion reported a collision
after its explicit SQL COMMIT had taken effect. Actual band schema/RPC presence
was verified, then a separate verification-only tracked migration was recorded.
Do not describe the initial history response as a clean success or blindly rerun.

Validation: isolated snapshot TypeScript, 12 focused regressions, 27 Gmail harness
tests, targeted lint, disposable PostgreSQL and Vercel production build passed.
The production build's configuration guard verified database alias targets and
key equality inside Vercel. The broader isolated suite was not all green: existing
Gmail harness dependency failures were resolved by including its current harness;
unrelated interaction-color and external website sibling-path failures were not
changed or hidden. Earlier 1,083-test results apply to the complete dirty workspace,
not this exact isolated snapshot. Intercepted browser checks previously passed;
real authenticated staff acceptance remains unperformed.

Post-promotion public checks: contacts/bands pages return login redirects;
family/draft APIs return 401 without a session. No live email or synthetic
customer write was used as a smoke test. Source checkout remains uncommitted and
unrelated dirty work remains intact. Deployment/promotion logs are in
`/tmp/pulse-band-family-{deploy,promote}.log`; release validation logs use
`/tmp/pulse-release-*`.

## Implemented, not deployed

The live band creation adapter now uses Beta's `WorkflowEditor` rather than a
second form. Save & close waits for durable storage before closing. The workspace
lists drafts with progress and Continue; resume restores fields and progress.
Revision checks reject stale saves. Completing a draft writes the profile and
prospect memberships in one primary-database transaction. Retrying a completed
draft returns the same band instead of creating it twice. Description and teacher
are retained. The roster shows confirmed, pending and prospect counts.

Live contact editing reuses Beta's `ParentFamilyGroup` for dependent creation,
relationship changes and removal. Its async adapter waits for database success.
The Account managers section supports choosing an existing account or creating
an account-summary manager, linking existing students across accounts, and
deliberate unlinking of additional accounts. It does **not** merge accounts,
reassign primary billing, establish a new person/account-holder identity, invite
portal users, or grant messaging authorization. Primary account removal remains
blocked pending an explicit reassignment workflow and billing/routing review.

All mutation routes authorize the selected tenant and contacts.manage permission;
family mutations additionally reject family/customer roles. Atomic family writes
verify the actual account/person/student tenant IDs, use per-student revisions,
and record idempotency operations. No surname/email matching establishes links.
Additional links default to communication_enabled=false. Existing links retain
their existing routing behavior. Recipient and conversation loaders fetch the
flag; it must never be omitted by a new delivery path.

## Approval and deployment dependencies

### Read-only schema review — November 20, 2026

Authorized Supabase management metadata was inspected for production **Odeon**
(`jbrntsxmibfldocsuslt`), not the similarly named **Odeon-staging** project
(`xpnygavujqmzkdmcktdm`). No customer rows were selected or changed. The inventory
and column/foreign-key metadata cover accounts, students, people,
student_accounts, account_holders, band_profiles, band_memberships, instructors
and enrollments. This is a partial schema review, not rollout approval or a full
constraint/index/trigger audit: the metadata tool does not fetch indexes and its
per-table row counts are not reliable evidence of holder population.

- Production `enrollments` has `session_name` and `custom_fields`, **not** a
  `band_name` column. Draft completion previously queried that nonexistent column.
  The unapplied draft migration now checks `custom_fields->>'band_name'` and
  `session_name`. The rehearsal now omits the fictional column; it reproduced the
  failure before the fix and passes after it, including both label collisions,
  case-insensitive checks, rollback and tenant isolation.
- `band_profiles` has the `(tenant_id,band_name)` primary key; description and
  coach_person_id are absent. The documented coach prerequisite is still needed.
  `band_memberships` has the `(tenant_id,band_name,person_id)` primary key.
  Instructors resolve through tenant_id/person_id as the writer expects.
- Accounts require tenant_id/name and generate UUIDs. Students require
  tenant_id/person_id; account_id is nullable, client_status defaults to active,
  message_routing to account_holder and is_minor to true. New dependent writes
  explicitly supply prospect status and routing rather than inheriting status.
- `student_accounts` exists with student/account foreign keys, relationship and
  is_primary; communication_enabled is absent. Students have no family_revision.
  The new family migration remains required, and messaging readers must deploy
  with it, not ahead of it. Verify the composite unique constraint from Migration
  001 explicitly; per-column `is_unique` flags do not prove that constraint.
- `account_holders` is a distinct tenant/account/person relation with relationship
  and is_primary. Its existence does not establish any person's holder identity,
  consent or payer. Existing-person mapping and primary reassignment remain
  blocked pending an explicit identity and billing/routing review.
- Local `.env.local` primary **and** CRM URL hostnames both reference staging.
  The separately listed CRM project (`xxyncvaulboqytovgfrh`) reports INACTIVE;
  production also lists CRM-named tables. None of those facts establishes which
  target the deployed CRM client uses. Verify deployed configuration and canonical
  ownership before designing a cross-database outbox or resuming any project.
  No environment values, project state, opportunities or scheduler were changed.

Follow-up validation: `check:integration` passed (TypeScript and 1,083 tests),
the corrected disposable PostgreSQL rehearsal passed, targeted script ESLint
passed and `git diff --check` passed. Logs: `/tmp/pulse-parity-schema-before.log`
(expected pre-fix failure), `/tmp/pulse-parity-schema-after.log`,
`/tmp/pulse-parity-schema-integration.log`, `/tmp/pulse-parity-schema-lint.log`.
The PostgreSQL readiness probe now waits for TCP rather than the image's temporary
socket-only initialization server. No browser rerun was performed for this
SQL/harness/documentation-only follow-up; the earlier intercepted results are not
authenticated staff or side-by-side Beta acceptance.

Do not deploy only the UI or only the routing-query changes:

1. Review actual production schema through authorized read-only access. The
   disposable rehearsal establishes SQL behavior against explicit fixture
   contracts, **not** that production has those columns, defaults, or constraints.
2. Confirm band_profiles, band_memberships, instructors, enrollments and the
   existing Migration 001 student_accounts relation. Confirm people, students,
   accounts tenant IDs and account-holder constraints. The application has a
   separately configured CRM client, not necessarily a separate physical DB.
   Transactional band completion does not create CRM opportunities. Automatic
   opportunity creation is deferred from this release; do not claim full parity.
3. Obtain approval to apply the primary-DB migrations in order:
   202611210001_band_coach.sql (if outstanding),
   202611210003_band_creation_drafts.sql, then
   202611210004_contact_family_management.sql.
4. Deploy the application and routing readers together after the columns exist.
   Missing storage fails closed with actionable errors. Family revision reads
   tolerate older schemas, but new writes require the transactional function.
   Messaging reads deliberately fail closed without communication_enabled.
5. Verify actual staff membership/permissions, draft save/reload/resume, teacher
   assignment, additional account linking/unlinking, relationship labels,
   multi-account display, delivery suppression, and concurrent/stale writes.
6. Inspect Tallman records read-only, then ask which explicit identities/accounts
   should be linked. No Tallman changes or account consolidation were performed.

Keep existing audit patches intact. No production migration, customer mutation,
email send, hosting change, commit or push was performed in this implementation.

## Reproducible validation

Local results on November 20, 2026: `check:integration` passed (TypeScript and
1,083 security tests); targeted ESLint passed with zero errors and two existing
unused-variable warnings in the contacts page. The PostgreSQL rehearsal passed.
The intercepted browser checks passed at both 1440px and 390px. `git diff --check`
passed. Existing dirty audit work was preserved; main remains even with
origin/main because nothing was committed or pushed.

- `npx tsc --noEmit`
- `npm run test:security`
- `node scripts/security/check-parity-postgres.cjs` — disposable local PostgreSQL
  container with no network or mounted production credentials; save/reload,
  stale writes, retry idempotency, atomic completion, tenant checks, primary-link
  protection, dependent creation and role grants.
- `PLAYWRIGHT_MODULE=<installed-playwright> node scripts/security/durable-parity-browser.cjs`
  — local development server on port 3250, synthetic signed demo identity, every
  API request intercepted; desktop 1440px and mobile 390px. Covers delayed-load
  skeleton, failed-save retention, close/reload/resume/complete, existing-parent
  linking and dependent creation. This is not authenticated production acceptance
  or a completed side-by-side Beta visual review.

Release gates still pending: deployed configuration verification, authenticated
staff acceptance and approved rollout. Full Beta relationship-manager parity
(primary-holder reassignment, existing-person mapping and billing safeguards),
Tallman review and automatic opportunity creation are deferred beyond this release.

## Release gate handoff — November 20, 2026

Keep this release limited to the implemented drafts and additional-account family
operations. Primary-holder reassignment, existing-person holder mapping, automatic
opportunity creation and Tallman changes are deferred, not extra release steps.

| Gate | Evidence / next action |
| --- | --- |
| Production schema prerequisites | Catalog checks completed read-only on Odeon. `student_accounts_student_id_account_id_key` is `UNIQUE(student_id,account_id)`; its index is valid/ready, with student/account lookup indexes. All returned constraints are validated. Band profile status accepts active. No non-internal triggers exist on the nine reviewed tables. This does not establish customer identity, row consistency or staff authorization. |
| Deployed configuration | **Access restored; values redacted.** After Vercel login, Pulse production deployment `dpl_EA9SkBJaXhSyuetJ8729FkD7i4Gw` is READY at commit `777eaa179e5bf723d0194e9120839e84f07b057e` (created November 20, 2026, 18:09:22 UTC), matching local HEAD but excluding uncommitted changes. Primary/CRM URL and service-key variables are present. API/CLI reads redact their values, so actual hostnames and key equality are not verified; equal redaction placeholders are not evidence. The production build guard requires both aliases to target Odeon and their keys to match. An authorized operator must confirm the actual settings or capture successful guard execution for this deployment without sharing secrets. No configuration was changed. |
| Authenticated acceptance | **Pending.** Requires a genuine staff session and an explicitly approved non-production test tenant/environment with these migrations installed. Do not forge a staff identity or mutate customer records. Staging migration/test-data approval is separate from permission to inspect metadata. |
| Production rollout | **Not approved/executed.** After acceptance, obtain approval for the exact migration set and app revision, apply coach/draft/family migrations in order, deploy routing readers together, then smoke-test. Preserve unrelated dirty audit patches and review the release diff before any commit. |

Authenticated acceptance checklist (no messaging sends):

1. Confirm signed-in tenant and contacts.manage permission. View-only staff must
   not mutate; tenant selection must not expose another tenant's drafts/contacts.
2. Save/close a named draft with description, teacher and students; reload and
   Continue. Recheck retained values and reject a stale second-tab save.
3. Complete once, retry the same request, verify one band/profile and prospect
   memberships. Check duplicate-name rejection and roster counts.
4. Create a dependent, link an existing additional account, change its relationship
   and unlink it. Verify primary account/routing and existing billing are unchanged;
   primary unlink must be blocked. New additional links must remain excluded from
   communication recipient/conversation resolution, without sending messages.
5. Review the same workflow beside Beta at desktop/mobile sizes; retain skeleton,
   error recovery and save-in-progress behavior. Record staff acceptance explicitly.

Latest local rerun passed: intercepted browser 1440px/390px
(`/tmp/pulse-parity-release-browser.log`) and disposable PostgreSQL
(`/tmp/pulse-parity-release-postgres.log`). These do not close authenticated
acceptance. The earlier TypeScript/1,083-test pass remains the latest integration
run; this follow-up changed documentation only. No production writes, migrations,
emails, commit, push or deployment occurred.

Vercel follow-up: login/project/deployment reads now succeed; the earlier 403 is
resolved. CLI environment checks used a private temporary directory, removed in
finally blocks. Values were redacted; no secrets were printed or retained. No
authenticated staff acceptance or production mutation was attempted.

## UI rhythm production follow-up

- Production deployment: `dpl_GVR1rDTfC8DsJS3qqjB8vyk8iM8q`, verified READY
  on `app.headlinerma.com`; predecessor `dpl_1oLVrR9SiLeeGZEMdVpTHP8fdPEq`.
- Release snapshot: `/private/tmp/pulse-ui-rhythm-release-20261120`, layered
  exclusively from `/private/tmp/pulse-modal-editor-release-20261120`.
  `ui-rhythm-release-files.json` records the exact eight-file SHA-256 allowlist;
  parent-content audit confirmed no unrelated checkout changes were included.
- Changes: separated Contact details H2; family card wrapper; removed redundant
  account-contact modal line; subordinate shared subscription typography;
  BandOS RichDataTable/search/preferences and tab spacing; right-aligned matching
  Add lead; product-requested app-wide removal of outline/shadow focus rings.
  Keyboard interaction and selected styling remain; visible keyboard focus is
  reduced, including forced-colors mode. This is an explicit product request,
  not an accessibility improvement.
- Validation: isolated TypeScript, production build, lint (0 errors / 34 existing
  warnings), 47 targeted regressions, synthetic production-build browser workflows
  at 1440px/390px passed. The broader interaction-colors suite has one existing
  Tabs brand-color assertion failure, reproduced on the unchanged parent snapshot;
  it was not silently fixed or reported as passing. Vercel production configuration
  guard and build passed.
- Canonical smoke: contacts GET 307 to login; family GET/POST and lead-count GET
  401 without authentication. Genuine authenticated staff acceptance remains open.
- Evidence: `/tmp/pulse-ui-rhythm-{deploy.log,deploy.exit,canonical-inspect.log,canonical-smoke.json}`
  and `/tmp/pulse-ui-rhythm-release-{types.log,tests.log,lint.log,build.log,build.exit,browser.log,browser.exit}`.
- No migrations, customer edits, sends, git commit or push. Family mutations still
  save immediately and are not rolled back by contact-details Cancel. Documentation
  updated checkout-only after deployment.
