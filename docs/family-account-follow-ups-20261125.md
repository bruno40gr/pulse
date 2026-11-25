# Family/account identity and follow-ups — local implementation

Date: November 25, 2026. Base: `b33f990aaaab5fae9c3564adcedd6ac2276a5b84`.
This is an implementation/validation record, not a deployment receipt. The user
authorized committing and pushing this combined Contacts slice. No hosted database
reads or writes, flag changes, hosted migrations or manual deployments are included.
Pushing Git may trigger configured hosting automation; served-build acceptance is separate.
The existing integration worktree was not edited; its status matches the starting snapshot.

## Identity and ownership contract

- `family_account_links` explicitly joins a member account to a canonical family
  account. Accounts remain separate billing and messaging identities. No people
  are created, no names are matched, and no student primary/secondary links,
  enrollment payers or routing preferences are rewritten.
- Existing people and existing accounts share the holder picker. Account options
  use an `account:` prefix and a distinct API/RPC, never a person ID masquerade.
  Manage account holders stays in its existing location.
- Linking is tenant-scoped and idempotent. Cycles, moving an already linked member,
  attaching an existing populated family and changed operation retries are rejected.
  This initial surface deliberately does not offer unlinking/reparenting.
- Adult holder/student deduplication uses explicit holder-person mappings only.
  The holder's own student role does not count as a dependent. A same-name person
  without verified identity remains separate. Holder rows render their own
  Enrolled/Disenrolled/À la carte/Service client and Instructor badges.
- `account_follow_ups` in CRM owns one reminder per tenant/canonical account.
  Account aliases resolve through primary family links before reading/writing.
  No arbitrary adult or child owns the family reminder. Date/message, completion,
  clearing, optimistic versions and immutable history are retained.
- Individual/inquiry reminders remain separate and accessible. Family reminders
  participate in list date summaries and existing filters; saving refreshes the roster.
  Missing additive storage cannot accept a write or silently fabricate a saved reminder.
- Sharing a display family does not expand account-message recipients to students
  whose saved primary account belongs to another payer.
- Contacts relationship badges belong beside each person's name, not in a Status
  column. Pipeline statuses in Leads remain unchanged. Separate Follow-up date
  and Follow-up note columns sort independently in both directions, with blanks
  last. Saved layouts retire Status and add notes for existing date-column viewers;
  saved density/page size remain intact. New layouts show both follow-up columns
  when the existing shared-follow-up feature is enabled.

## Database rollout — NOT executed

1. Back up and review each actual target independently. The primary and CRM
   databases may differ; do not apply every migration to one database by assumption.
2. Primary database: `202611250001_family_account_links.sql`, after existing
   `contact_family_operations`/family-management prerequisites.
3. CRM database: `202611250002_account_follow_ups.sql`.
4. Verify ACLs/RLS, RPCs, tenant isolation and failure behavior before enabling
   any account-link writes or relying on shared reminders in the authenticated app.
5. Verify the actually served build and existing shared-follow-up flag separately.
   A Git push is not evidence of deployment.

Rollback: revert application changes first; retain additive tables and reminder
history. Do not drop tables or delete account links/reminders as an automatic rollback.
Family links do not move billing, but removing a link can change which reminder
an alias resolves to; any unlink/reparent workflow needs explicit review.

## Validation

- TypeScript: no errors.
- Focused identity/family/follow-up/subscription/preferences tests: 57/57 passing.
- Disposable network-disabled PostgreSQL 17: both new migrations executed locally;
  account identity, idempotency, cycle/foreign-account rejection, stale versions,
  finite dates, complete/clear history, RLS/ACL denial and unchanged payer/routing
  snapshots checked. Hosted default ACL grants were simulated before migration.
- Synthetic loopback browser: 1440px and 390px pass adult-once/own-badge/zero-dependent,
  shared reminder save/complete and existing-account search/link. All APIs intercepted.
- Full test suite: see the manifest for final totals; retains the known 17 baseline failures (Gmail synthetic contracts
  and selection-color source contract); see the machine-readable manifest for totals.
- Changed-file lint: zero errors, two existing Contacts warnings. Broader application
  lint (`app components lib`) reports 31 errors/80 warnings; all error files are
  untouched by this slice. Broader scans including scripts/prototype copies have
  additional existing violations. `eslint .` also includes generated `.next`
  artifacts and is not a valid source gate. No repository-wide lint pass is claimed.
- Existing individual follow-up browser tests pass at 1440px/390px, including delayed
  skeletons, error/retry, failed draft retention and pending-save dismissal prevention.
- Contacts table browser at 1440px/390px verifies ascending/descending date and note
  sorts, blank-last behavior, persisted sort on reload, own relationship badges in
  name cells and no Status column. Every API is intercepted; no writes occur.
- Evidence and the uncommitted patch archive are in
  `/Users/brunowong/pulse-backups/family-account-follow-ups-20261125-075644/`.

## Deliberate limits / remaining acceptance

- No real Scott/Meredith or Rob/Alexandra relationships were changed. Authorized
  staff still need to select the verified records after rollout.
- Legacy account/person identity is not auto-reconciled. A legacy account named
  like an adult person does not by itself establish that they are the same identity.
- Truly empty accounts are selectable in the directory and have an account reminder
  API, but the Contacts table remains person/student-derived; this slice does not
  introduce a new exhaustive account-only directory.
- Account membership does not implement a new per-subscription payer editor.
- Production/authenticated acceptance and reviewed rollout are still required.