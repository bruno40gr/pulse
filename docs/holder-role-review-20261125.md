# Holder roles, cards and follow-up repair — November 25, 2026

## Identity review

Reviewed the production student/account relationships and September 25 clients
CSV, matching `people.custom_fields.external_id` to unique source `Id` values.
Student-named accounts were review candidates, never proof of a holder identity.
The review found 13 exact source/account pairs with separate manager source IDs.
The checked-in evidence contains opaque IDs only, not names or destinations.

These legacy billing accounts remain unchanged. Their account-name fallback is
suppressed in the holder display; explicit holder-person rows still take priority.
Nathan/Jonathan remain students/dependents; Cynthia/Sam remain visible through
saved student-account relationships. A deliberately empty `account_holders` list
is authoritative, so the display helper cannot reintroduce a billing shell.
Unreviewed accounts and adult holder/student roles are not removed by heuristics.
Three reviewed students have no additional live manager account; their display
uses a neutral Family label instead of inventing a holder. This does not import
missing people or convert historical CSV evidence into current permissions.

Billing accounts, subscription payers, routing summaries, reminder account IDs,
student membership and communication flags are not rewritten. Scott was not
linked to any family.

## UI and follow-ups

Holder details reuse DenseSectionPanel, FieldGrid and DetailField, matching the
subscription/entity-card structure and responsive field rules. No recipient
checkbox or inferred consent is added. Family navigation uses the display family
label, not the legacy billing summary.

The Add follow-up action remains reachable after a read failure. Read errors
remain honest failures, not false empty success; successful empty reads render
No follow-up scheduled. Opening the modal does not clear an unresolved load
error. Saving continues to require version checking and persisted server success.

## Authorized database rollout

The user explicitly approved both formerly held migrations in this conversation.
Verified consolidated production is `jbrntsxmibfldocsuslt`; CRM compatibility
variables target this same project per the recorded consolidation cutover. The
frozen former CRM and local staging project were not used as production targets.

Installed via tracked migrations:

- `20261125173530` — `family_account_links_202611250001`
- `20261125173558` — `account_follow_ups_202611250002`

Read-back confirms all three tables have RLS enabled, browser roles have no table
or RPC grants, and only service_role can execute linking/reminder writes. History
is append-only for service_role. Production still has 324 accounts; zero links
and zero account reminders were created by rollout. Application rollback should
retain these additive tables/history, not drop customer data.

## Validation

- 71 focused tests pass, including the actual Contacts reader for both reported
  students, all 13 reviewed source/account pairs, foreign-tenant/source mismatch,
  explicit-empty holder handling, and preservation of billing/reminder/routing IDs.
- Disposable PostgreSQL 17 executes both migrations and checks replay, cycles,
  foreign-account rejection, stale versions, dates, audit history and ACLs.
- TypeScript passes. Changed-file lint: zero errors, two existing Contacts warnings.
- Desktop 1440px/mobile 390px browser acceptance passes: normal holder cards,
  account-only holder visibility, empty follow-up state, modal save/complete,
  existing-account picker linking, and opening the modal after a read failure.
  Browser APIs are synthetic, not an authenticated production roster check.
- Full-suite comparison and production deployment receipt are recorded in the
  final task response; logs are `/tmp/holders-review-{focused,full,types,lint,browser}.log`.