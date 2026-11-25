# Targeted UI and subscription-reader restoration — November 25, 2026

Status: reconciled in `/Users/brunowong/pulse-main`, based on
`a028889`; user authorized commit and push on November 25. Not deployed by this
restoration task. No production queries/writes, migration execution or
feature-flag changes. Historical deployed migration **source files** are restored
for provenance and isolated tests; this is not approval to replay them.

## Cause and evidence

Main and the integrated release branch diverge at `777eaa1`. The scoped admin
release intentionally excluded the Staff/Services/calendar line. However, that
line also contains previously deployed presentation and subscription-reader
improvements. Earlier production releases used isolated snapshot overlays that
were not incorporated into main before the later main-based deployment.

`/Users/brunowong/pulse/docs/subscription-summary-consistency.md` records the
November 22 card deployment. Its source snapshot survives at
`/private/tmp/pulse-card-summary-release-20261122`; the 13 allowlisted files match
their stored SHA256 manifest. Seven isolated lesson-summary/presentation files
restored here match that previously deployed snapshot exactly. This was a release
baseline/integration gap, not evidence that a028889 itself deleted those files.

Older Contacts readers could resolve a sunset teacher as a current instructor
or fall back to historical free-text names. The restored reader uses tenant-local
teacher identities and suppresses sunset/inactive/ended/archived assignments.
Either native or imported ended status excludes a subscription. List/detail and
post-edit responses share the current-subscription projection. No names/records
were deleted. This mechanism explains a possible regression in former-teacher
presentation; the specific reported people have not been verified against live
data or the user's authenticated screen.

## Restored scope

- Shared lesson identity/details summaries, upcoming lesson and move/makeup
  summaries; subscription card title retains current shared heading convention.
- Live subscription duration/level from explicit source fields without invented
  Level 1; absent current teacher shows a verification message.
- Workspace loading and Suspense skeletons instead of blank output.
- Tenant-scoped sample Staff deep links redirect to operational Staff without
  loading/saving a sample workspace. Live workspace errors no longer link users
  into the sample calendar.
- Tenant-scoped current teacher/subscription reader parity and roster filtering.

Expanded after lead-agent takeover and explicit Act authorization:

- Live family management API/UI, account-manager/dependent selection, additional
  account projections, tenant-scoped family revision reads and communication
  suppression for newly added family links.
- Focused contact editor, actual dirty-state tracking and app-modal keep/discard.
- Participant-picker improvements and mobile slidepanel-header action wrapping.
- Deployed band draft/resume transport, revision/conflict handling, description
  projection and corresponding wizard/workspace behavior. Existing write gates stay.
- Previously shipped global no-focus-ring styling, explicitly reaffirmed by the
  owner on November 25. Keyboard focus/navigation are not disabled. Documented in
  `/Users/brunowong/pulse-main/docs/ui-interaction-colors.md`.
- Idle-page lead notification expiry and matching-toolbar alignment, without
  replacing the current server's 24-hour badge calculation or admin fixes.

Intentionally excluded: unfinished operational calendar/Services writers, execution
of source imports, unapproved scheduling migrations and blanket integrated-branch copying.
Demo data is not erased. No browser storage cleared.

## Inherited shipped-feature checklist

All eight inherited manifests and their 53 unique file paths are inventoried in
`/Users/brunowong/pulse-main/docs/ui-restoration-release-manifest-20261125.json`.
The manifest records per-file disposition and source/current SHA256 values.

| Inherited release | Disposition |
| --- | --- |
| Band/family parity | Restored missing runtime functionality; historical SQL source retained, not executed |
| Family/editor follow-up | Restored dirty/discard editor, mobile header wrapping, participant controls and family API integration |
| Lead count | Preserved admin server badge timing and current role mocks; restored idle notification expiry |
| Family hierarchy | Restored person-name/action-menu presentation and family modal composition |
| UI rhythm | Restored picker separation, toolbar alignment and no-ring CSS; retained newer card-heading convention with shipped bold weight |
| Modal editor | Restored focused edit canvas and header-owned Save/Cancel |
| Family inline | Restored add-student access, manager/dependent modal composition and family editor placement |
| Card summary | Preserved shared lesson summaries and readers; reconciled newer admin and teacher verification behavior |

The older `ui-rhythm.test.cjs` file is intentionally not copied verbatim because
it rejects the current `variant="card"` convention. Equivalent approved focus and
card behavior is covered by restoration tests and computed-style browser checks.
Current synthetic range-filter mocks and newer lead timing tests are retained.

## Unrelated release preservation

The existing admin badges, mentions, shared follow-up UI/API/migration, latest
lead-badge timing and expanding-note fixes remain. Shared Contacts files were
edited selectively, not replaced by older snapshot copies. Detail route reader
changes were ported from the committed integrated branch; a028889 did not modify
that route. Tests cover continued ContactFollowUps and relationship UI integration.

Pre-change all-ref bundle and clean-main baseline recorded at
`/Users/brunowong/pulse-backups/ui-regression-restore-20261125/`.
The bundle passed `git bundle verify`. No destructive Git operations occurred;
this is not a claim of a completed restore drill. The other worktree's ongoing
uncommitted calendar/admin work was not edited.

## Validation and limits — takeover rerun

- TypeScript: `./node_modules/.bin/tsc --noEmit --incremental false` passed.
- Focused restoration/family/teacher/picker/band/loading tests: 51 passed.
- Admin preservation/restoration checks: 43 passed (overlaps the focused set).
- Full suite: 1,118 tests, 1,101 passed and 17 failed. Failure names match the
  independently rerun clean a028889 baseline (1,088 tests, 1,071 passed, 17 failed):
  Gmail fixture dependency mocks and selection brand-color assertions. The isolated
  baseline needed its existing sibling website dependency linked at
  `/private/tmp/headliner-app` before parity comparison; its website tests then
  passed. Do not report all green. Logs use `/private/tmp/ui-takeover-*`.
- Changed-code lint: no errors, 36 unused-symbol warnings (Contacts/Leads).
- Whitespace checks passed.
- Actual restored SubscriptionCard/LessonSummary and LoadingSkeleton rendered
  through isolated component/browser checks at 1440px and 390px; no horizontal
  overflow. Screenshots: `/private/tmp/ui-restoration-{1440,390}.png`.
- Disposable PostgreSQL rehearsal passed: draft conflicts/atomic completion,
  family idempotency/revisions, cross-tenant rejection, manager operations,
  messaging isolation and direct-role grants. Docker used no network; no live DB.
- Actual restored source modules ran on isolated loopback Next host
  `/private/tmp/pulse-takeover-browser-20261125`. All API requests were intercepted.
  Desktop/mobile band retry/resume/completion, family manager/dependent operations,
  unchanged/reverted cancel, dirty keep/discard and shared follow-up checks passed.
- Delayed Contacts/workspace reads, explicit duration/level, unresolved-teacher
  messaging, focusability without outlines/shadow rings, Staff redirect and no
  sample fallback/storage clearing passed at 1440px and 390px. Staff destination
  was a fixture; this does not verify authenticated operational Staff contents.
- Follow-up modal passed desktop/mobile/landscape; contact follow-ups passed
  delayed loading, pending-save protection, failed-draft retention and retry.
- Authenticated production navigation, tenant switching and the specific reported
  former-person display remain unverified. No production build/deploy performed.

Takeover recovery archive (22 inherited dirty/untracked files, hash-verified):
`/Users/brunowong/pulse-backups/ui-takeover-20261125-023354/`.
Integration-worktree changed-file hashes were captured and rechecked unchanged.

Three historical band/family SQL sources are included because their deployed
writers and regression tests depend on them. Existing rollout records describe
hosted migration-version collisions; do **not** run an automatic migration replay.
This restoration requires no new production migrations, flags or customer writes.

Before deployment, review this exact diff and release scope, retain recovery
evidence and explicitly approve promotion. No reverse merge, blanket cherry-pick,
reset or automatic deployment is authorized by this repair. Keep future deployed
overlay manifests reconciled into the version-controlled release baseline so a
subsequent scoped release cannot silently omit earlier shipped improvements.

## Follow-up verification: skeletons and replacement teachers

The inherited November 22 teacher-reconciliation record identifies the Bridget
Pique/Vikram case: the recorded production repair assigned Vikram's current
subscription to Isaias Pallib and retained Bridget's enrollment as ended history.
This is historical evidence, not a fresh production read. The same record notes
21 unrelated legacy assignments outside that repair's source scope; the UI must
show unresolved-teacher verification rather than guess their replacements.

The follow-up found and fixed one additional list-reader inconsistency: its
summary used the first stored enrollment, while cards/detail already selected
current student enrollments. The list now uses the shared current-enrollment
selector. A synthetic regression with ended former-teacher history first verifies
the replacement teacher appears in the list summary and subscription projection.
Follow-up targeted tests: 17/17 passed; TypeScript, targeted lint and whitespace
checks passed. The earlier full-suite figures above predate this one-test addition.

## November 23 provenance reconciliation — November 25 follow-up

The eight November 22 overlay manifests were **not** a complete recovery baseline.
The earlier follow-up fixed the first-enrollment caller but missed its query and
importer integration. Its fixtures supplied a status field the real query did not
select. Do not treat the preceding follow-up as evidence of complete restoration.

Reviewed original commits `bf05621b48363917c00d3a8868ff2077b89c78fd`
and `a9da509b59b648fda6bd8ffa7ce9cdb6e5ee84f8`, the surviving November 23
integrated-validation and operational-staff-repair snapshots, and these records
in `/Users/brunowong/pulse/docs/`:
`subscription-teacher-reconciliation.md`, `subscription-summary-consistency.md`,
and `integrated-production-readiness-20261123.md`. The first snapshot predates
the consolidated helper; the operational snapshot contains the consolidated
helper and current-status selector. The recorded November 22 card overlay
predates those later integration fixes and cannot supersede them.

### Original behavior inventory and disposition

| Original solution element | Disposition in this restoration |
| --- | --- |
| List enrollment query: native `status`, instrument, format, schedule, plan/session, JSON metadata, teacher identity | Missing `status` restored; entire subscription projection matches `a9da509` |
| Teacher query: tenant-scoped identities and lifecycle metadata; no historical-name fallback | Preserved; shared teacher helper exactly matches `a9da509` |
| List summary: current non-booking enrollment rather than first stored history | Restored original selector; optional-argument default is equivalent |
| Booking-only versus student identity | Original `no current student enrollments && first stored enrollment is booking` predicate restored; mixed current lessons retain student identity |
| List, detail and post-edit subscription projection; native/imported ended exclusion | Detail route, `contact-subscriptions`, `current-enrollment` and teacher helper exactly match `a9da509` |
| Card duration/level, all current subscription rows, unresolved teacher verification, filter teacher identities | Preserved in current Contacts types, subscription cards, teacher filter options and `LiveContactPanel`; admin badges/shared follow-ups retained |
| Identity-preserving subscription export parser | Missing `lib/subscription-source.ts` restored exactly from original; preserves subscription/client/staff IDs and explicit level/duration; ended excluded |
| Reject subscription exports at legacy attendance import entry | Original 409/400 guard restored before import-profile reads/writes and person grouping, including empty/ended-only exports |
| Legacy enrollment update lookup excludes source-linked subscriptions | Original `custom_fields->>subscription_id IS NULL` guard restored; no repair importer run |
| Original parser, current-status and list/detail regressions | Parser test recovered exactly; three omitted original status assertions restored; existing shared-projection tests retained |
| Query and importer integration regressions | Four new offline route tests fail before the reconciliation and pass after; actual query filters/projections asserted so fixture-only fields cannot mask missing selection |
| Original subscription migration, rollback SQL and database reconciliation harness | Intentionally excluded from this reader/UI restoration; deployed historical data repair is not replayed or rolled back |
| Original standalone subscription-card browser harness | Superseded for this slice by existing durable-parity and UI-restoration browser harnesses at desktop/mobile, including explicit fields and unresolved teachers |
| Academy workspace actor migration, operational staff writer/setup and broader Services/calendar changes in the reference commits | Excluded; not required for the original subscription-reader/import-safety contract and not authorized in this restoration |
| Historical deployment/production repair records | Read-only provenance only, not fresh authenticated acceptance |

The reconciliation restores original behavior, not a guessed teacher assignment.
The historical Vikram/Isaias repair remains historical evidence only. No live
contact record has been queried or changed here. The original migration and
source-ID reconciliation tools remain on their historical release line.

Pre-reconciliation recovery archive:
`/Users/brunowong/pulse-backups/subscription-reconcile-20261125-025621/`.
Archive contents were SHA256-verified before edits. The older takeover archive
does not include these follow-up fixes. The integration worktree remains untouched.

### Final reconciliation validation

- TypeScript `tsc --noEmit --incremental false`: passed.
- Focused subscription tests: 16/16 passed; final Contacts/current-status/UI
  contract run after restoring the original assertions: 18/18 passed.
- Full security suite: **1,108/1,125 passed, 17 failed**. Failure names exactly
  match the independently executed clean `a028889` baseline; no additional
  failures. This is not a green full suite. The first reconciliation run exposed
  one missing parser dependency in a hand-wired route test; its loader now loads
  the real parser and the test passes.
- Changed-code ESLint: zero errors, 36 warnings. Whitespace checks passed.
- Desktop (1440px) and mobile (390px) durable-parity browser checks: passed,
  including editor dirty/cancel/discard and band/family interactions.
- Desktop/mobile UI-restoration browser checks: passed, including delayed-loading
  skeletons, explicit subscription fields, unresolved teachers, keyboard focus
  without rings, Staff redirect and no sample fallback/storage clearing.
- Browser checks use the existing isolated loopback fixture host at port 3271,
  intercept API IO and do not establish authenticated production acceptance.
- Earlier isolated PostgreSQL rehearsal remains applicable: this follow-up changes
  no SQL or band/family persistence contract. No production migrations executed.

Evidence logs: `/private/tmp/subscription-restoration-{before,focused,full,types,lint,final-targeted,parity-browser,loading-browser}.log`.
Commit/push is authorized by the user. This does not authorize a manual deployment,
production data repair, migration replay or flag change. Authenticated verification
of the specific Bridget/Vikram screen remains open.