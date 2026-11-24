# Integrated release: production readiness continuation

November 23, 2026 (Pacific). Local changes only; not production acceptance.

## Reviewed compatibility and local fixes

- Starting branch was clean at `fe41cf9`, matching its remote-tracking branch.
- New forward migration `202611230003_academy_workspace_auth_source.sql`
  replaces the four-argument save function with a service-role-only five-argument
  function. The API supplies its verified context's authentication source, never
  a client field. Supabase actors require active membership. Legacy actors require
  legacy access enabled and active, invited or unclaimed membership. Foreign,
  suspended, deactivated and retired-legacy actors fail closed. No accounts are
  activated or reset. Permission authorization remains at the API boundary.
- The function locks the membership during the save and retains row-lock/CAS
  semantics. The API requires an incremented revision before reporting success.
- Disposable PostgreSQL rehearsal covers historical installation and forward
  upgrade, actual service-role execution, browser-role denial, actor policy,
  retired legacy access, stale revisions, concurrent writers and persistence.
  This is not a production restore or deployment rehearsal.
- Production aggregate SELECTs through `SUPABASE_RUN_READ_ONLY_QUERY` found 221
  source-linked subscriptions: 214 active and 7 pending. All 221 have instrument,
  format, duration and teacher IDs; 192 have a level. The full population still
  includes 103 active rows with no imported status, plus seven native-active rows
  whose imported status is ended. Counts do not establish reconciliation.
- Contact cards now receive stored duration instead of depending exclusively on
  plan text. Unknown levels remain absent. Offline API-to-summary tests cover this
  contract; authenticated production card rendering is still unverified.
- Follow-up aggregate SELECTs establish that the 103 native-active rows with no
  imported status belong to 103 students, none sharing a student with a
  source-linked subscription. Their fields have legacy contact/attendance shape;
  neither booking-wording nor the reader's Admin booking pattern matched them.
  These facts do not establish that the subscriptions are still valid. Retain
  existing read behavior rather than delete, reclassify or invent source links.
- The seven native-active/imported-ended rows belong to seven separate students,
  also without source-linked subscriptions. Imported-ended filtering already
  excludes them. Either native or imported ended status now excludes a row.
- List, detail and contact PATCH responses use the shared
  `lib/contact-subscriptions.ts` projection. Detail no longer attempts the obsolete
  staff join, preserves all current subscription cards, and resolves teachers by
  tenant-scoped person IDs. Unknown/former/foreign teachers stay unresolved.
  The instructor roster now scopes enrollment reads to the tenant and excludes
  ended enrollments. No subscription mutation behavior was added.
- Local browser rendering at 1440px and 390px consumes an actual offline detail
  API response: stored duration without plan wording, explicit/unknown levels,
  separate teacher identities and ended-row exclusion pass with no overflow.
  Every network write is blocked and all API reads are intercepted. This is
  synthetic UI evidence, not an authenticated production session.

## Workspace provisioning decision

Do not provision by copying `createDemoWorkspace`, importing customer identities
into staging, matching names, or assigning default qualifications/hours. Do not
silently create a workspace when Staff opens. Production currently lacks the
workspace relation and RPC; the operational API must continue to fail closed.

An approved provisioning artifact must contain the selected tenant, explicit
existing instructor/person links, provenance for scheduling assignments and all
required school configuration, expected revision, and a checksum. Empty eligibility
lists mean unconfigured, not permission to teach. Existing workspace records must
be preserved through CAS, not overwritten by a seed. Resolve duplicate/unlinked
profiles explicitly. Validate against actual persisted teaching/Admin work before
offering availability edits: an empty booking snapshot cannot prove compatibility
with the school's current lessons. This mapping/reconciliation is unfinished.

Keep work-profile editing unavailable until storage, actor policy, identity mapping
and authoritative scheduling prerequisites work together. Do not expose the Beta
calendar merely because a workspace table exists.

## Bounded proposal for later approval — not an execution instruction

1. Finish integrated-diff and authenticated read-only rendering review. The shared
   list/detail subscription contract and synthetic rendering now pass; legacy
   flattened fields still summarize one current enrollment and are not the
   multi-subscription source. Reconciliation of the 103 legacy rows remains open.
2. Inventory the actual production migration ledger and schema. If workspace
   storage is absent, review only the original workspace DDL plus actor/revision
   and auth-source forward migrations. Do not run all pending migrations or any
   subscription import. No configuration changes are currently proposed.
3. Prepare and verify a pre-change database backup and isolated restore. Capture
   the actual canonical application deployment, source archive and schema/function
   definitions. Rehearse the exact provisioning artifact and deployment order.
4. Obtain explicit approval for the exact source revision, DDL, provisioning,
   application promotion and any separately scoped production write test.
5. Apply approved database prerequisites before the matching application. The
   new RPC removes an old signature: mixed old/new writers require a maintenance
   window or an explicitly reviewed compatibility strategy. The old app cannot
   use the new RPC; do not treat an app-only rollback as sufficient.
6. Recovery: disable affected editing first. Restore the prior app and matching
   function definition only under the approved recovery plan. Preserve workspace
   rows and post-release edits; never blindly drop the table or restore an entire
   database over unrelated customer writes. A newly provisioned workspace may
   be removed only with a verified unchanged revision and explicit approval.

## Validation

- 1,150 security tests pass; TypeScript passes; targeted ESLint has zero errors
  and two unused-variable warnings in the Contacts page.
- PostgreSQL rehearsal passes in a network-isolated disposable container, which
  is removed afterward. No production credentials or data enter that container.
- Evidence: `/private/tmp/pulse-workspace-policy-{suite,tests,types,lint,postgres}.log`.
- Reader evidence: `/private/tmp/pulse-subscription-reader-{suite,types,lint,browser}.log`
  and `/private/tmp/pulse-subscription-parity-tests.log`.

No production migration, provisioning, promotion, configuration change or write
test has been performed. `main` has not been touched. Persistent staging and
manual fake-data Preview acceptance are not blanket release gates; see
`staging-and-release-workflow.md`.