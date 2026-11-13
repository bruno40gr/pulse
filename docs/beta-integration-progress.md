# Beta integration progress — November 13, 2026

## Current status (supersedes historical checkpoint notes below)

- Working directory: `/Users/brunowong/pulse-beta-integration`; branch
  `integration/beta-20261113`. Main remains `9d5c5cc` and matches the live remote
  ref checked during the hygiene pass. Nothing merged, pushed or deployed.
- Committed integration checkpoints: `e003edf` preserves main's pending
  performance work; `ba68944` patches dependencies; `656ab1a` promotes shared
  controls; `f167748` reconciles models/Parent workflows and Leads adapters;
  `17d958e` corrects sample ownership to reuse existing Beta identities.
- Beta sample families/students remain authoritative. No prototype directory is
  added to the Parent selector. Workflow state starts empty against those IDs.
  Full synchronization of later sample-session edits with the staff queue is
  still a pending integration concern, not a proven database feature.
- The latest verified suite is 316/316, with passing TypeScript and focused
  correction lint. Desktop/mobile Parent continuation, family reschedule/makeup
  and Reschedule together passed their respective browser runs. Sharp runtime
  conversion passed. These are scoped checks, not full release approval.
- Staff Explorer, its Contacts action/adapter composition, image controls and
  supporting primitives remain dirty/untracked WIP. TypeScript passing does not
  establish those unfinished screens as functional or approved. Preserve this
  WIP; do not publish it or include it in a documentation-only commit.
- Staff navigation placement remains a user decision. Keep the prototype access
  guard, operational API routes, main's newer calendar and permission/security
  behavior. Real contacts and transactions remain disconnected.
- Full production build is still blocked by missing approved nonproduction
  Supabase configuration. Earlier audit evidence reports zero production
  findings and seven tooling-inclusive findings; it is historical, not a fresh
  audit in this documentation/hygiene pass.
- Ongoing principles are in `docs/integration-principles.md`. Hygiene details and
  recovery locations are in `docs/beta-hygiene-20261113.md`.

## Sample-data correction — existing Beta directory wins

User clarified that the prototype's fake contacts should not be imported into
Beta. Runtime queue initialization now projects the existing Beta sample account
and student IDs through `academy-beta-people.ts`; it seeds no prototype contacts,
inquiries, registrations or band memberships. Parent family selection uses only
the existing Beta snapshot again. No real contacts or APIs are involved.

The queue uses `odeon:beta-enrollment-portal:v2` so older prototype queue storage
cannot silently restore the separate directory. Old storage is not deleted.
Legacy lifecycle tests inject their own explicit fixtures; a new regression
asserts that runtime people all belong to the Beta sample directory.

Validation: 316/316 targeted tests, TypeScript, focused correction lint and
whitespace checks pass. Parent request open/save/resume passes at 1440px and
390px using an existing Beta student, without operational writes/errors/overflow.
Evidence: `/tmp/odeon-beta-existing-people-{full,lint,browser}.log` and
`/tmp/odeon-beta-staff-types.log`.

The staff Explorer reconciliation begun after the previous checkpoint remains
uncommitted and unexposed; Contacts action integration and review are unfinished.
Its institution switching no longer restores prototype contact fixtures. This
correction checkpoint is separate from that unfinished UI work.

## Domain and screen reconciliation checkpoint

Reconciled Beta enrollment, band, program, opportunity and workflow models under
`beta-source/lib`. The portal actions, queue, store and hook live there together;
Parent enrollment consumes that same hook. There is no copied root queue/store.
This remains fictional same-tab session transport, not authorization or payment
infrastructure. This checkpoint originally projected queued accounts into the
sample workspace; `17d958e` subsequently removed that behavior in favor of Beta's
existing families. Request drafts can open, save and resume without operational
writes.

StaffEnrollment now uses the shared stepper, search picker, checkbox and synthetic
card preview. School Setup gains optional embedded sections and externally owned
discount configuration, retaining default standalone behavior. Existing calendar,
makeup, family reschedule modules and their CSS were retained, not replaced.

Shared Leads now accepts an explicit fictional request adapter while the default
remains fetch. Main's coalesced account-context permission loading, debounced
summaries, records cache, pagination, deletion checks and server routes remain.
The fictional adapter supports main's summary-only and include-counts contracts.
Dependent editors/composers receive the same request boundary; main's SMS review
and campaign-create error handling were retained. Band-only student fields are
opt-in; ordinary student editing keeps its established composition.

Not yet reconciled/exposed: the full staff Explorer, its Contacts panel adapters,
and staff navigation placement. Only BandEnrollment and ProgramAvailability were
ported from that directory as Parent dependencies. Do not interpret the shared
Leads adapter as approval to expose the whole staff explorer or to remove its
development-only guard. No operational API route changed in this checkpoint.

Validation on the isolated integration worktree:

- 315/315 domain, adapter-contract, Beta-access, Leads, performance-context and
  conversation tests passed; the final run is recorded in
  `/tmp/odeon-beta-reconcile-full-tests.log`.
- TypeScript and whitespace checks passed. Focused lint has no errors; existing
  unused-variable/image/hook warnings remain in older large Leads/composer files.
- Desktop 1440px and mobile 390px browser checks passed for family reschedule and
  makeup, Reschedule together, and Parent request open/save/resume. No operational
  writes, runtime errors or horizontal overflow in those checks.
- Sharp 0.35.5 decoded PNG, resized 16x16 to 8x8, encoded WebP and read metadata.
- Browser host `/tmp/pulse-beta-reconcile-host` on loopback port 3231 imports this
  integration worktree, not the original prototype. It omits production middleware
  and therefore does not validate deployment access controls.
- Production build remains blocked by missing approved nonproduction Supabase
  configuration; no secrets were copied and no deployment claim is made.

Evidence: `/tmp/odeon-beta-{calendar-browser,reschedule-browser,parent-browser-final,
reconcile-types,reconcile-lint,final-reconcile-lint,reconcile-full-tests}.log`.
No merge, push or deployment performed.

## Isolated release line

- Worktree: `/Users/brunowong/pulse-beta-integration`
- Branch: `integration/beta-20261113`, based on main `9d5c5cc`.
- Baseline commit `e003edf` preserves main's eleven pending tracked/untracked
  performance-related files. Originals remain unchanged; no push or deployment.
- Backups: `/Users/brunowong/pulse-backups/beta-integration-20261113`.
  All refs bundled; both working states restored into a disposable recovery repo
  and all 11 main / 127 prototype file hashes verified. A second bundle lives at
  `/Users/brunowong/odeon-private/pulse-branch-backups-20261113/beta-integration-all-refs.bundle`.
- This temporary release worktree is an explicit isolation exception to the
  normal one-release-line worktree limit. Do not delete any original/protected
  worktree or branch. Reconcile and perform the required recovery drill before
  eventual cleanup.

## Dependencies (historical patch checkpoint)

Next and eslint-config-next are pinned to 15.5.29, without a framework major
upgrade. Compatible transitive versions are refreshed in the lockfile, including
axios 1.21.1, follow-redirects 1.16.3, qs 6.17.1 and sharp 0.35.5. Next 15.5.29
explicitly permits sharp 0.35.5. Its PostCSS 8.4.31 pin requires a scoped
`overrides.next.postcss = 8.5.32`; both PostCSS consumers now resolve to 8.5.32.

`npm audit --omit=dev`: zero findings (previously eight affected production
packages). The full tooling-inclusive audit still reports seven affected dev
packages: six moderate and one high. Do not describe the entire dependency tree
as clean. Remaining findings involve TypeScript ESLint/minimatch and an older
brace-expansion dependency. No forced major upgrades performed.

Installed into this worktree independently with install scripts disabled; no
shared node_modules mutation. The production build compiled and passed its type
stage, then failed page-data collection because Supabase configuration is absent
(`supabaseUrl is required` for `/api/account/claim`). No production secrets copied,
the dependency audit alone; validate actual image processing before release.
no successful full build claimed. Sharp installation/runtime was not proven by
this dependency audit alone; the later runtime conversion check is recorded
above and passed.

## Shared component promotion (historical checkpoint)

- Added shared Checkbox, RadioOptionGroup/styles, WeekdayToggleGroup,
  ParticipationPolicies and SaveStatusNotice from the prototype.
- Promoted optional action-bar selection nouns, compact tab bubbles and stepper
  navigation/completion metadata. Existing default appearances/behavior retained.
- Reconciled sample-local table preferences with main's newer single-flight
  account-context loader; operational consumers keep that loader.
- Kept main's existing conversation harness. It already handles newer shared
  imports and passes; blindly copying the prototype repair would regress it.
- No wholesale Contacts/Leads replacement, API/middleware replacement or Beta
  calendar overwrite. No new workflow is reachable in Beta yet.

## Checks (historical shared-control checkpoint)

- 90/90 targeted tests pass: shared controls/tables, row selection, Leads table
  preferences and follow-up permissions/validation, conversation prototype,
  performance-context, visible polling and Beta access.
- The eight prototype follow-up failures do not reproduce on this main-based
  baseline. Retain main's newer API implementations.
- Focused lint and TypeScript pass. Diff whitespace check passes.
- New control tests exercise action-bar default/additive labels and clear,
  native radio selection callbacks, opt-in compact counts and opt-in step
  navigation. They are synthetic contracts, not browser/visual approval.
- No desktop/mobile browser checks or completed production build yet.

Evidence: `/tmp/odeon-beta-{shared-tests,final-lint,final-types,build}.log`,
`/tmp/odeon-beta-production-audit-final.json`, `/tmp/odeon-beta-final-audit.json`,
and `/tmp/odeon-beta-dependency-tree-final.log`.

## Remaining work

1. Finish staff Contacts/Leads composition and fail-closed simulated transport;
   use existing Beta sample identities and preserve complete operational UI.
2. Verify queue/sample-session ownership across staff and Parent consumers;
   retain one queue/store instance and explicit account/student relationships.
3. Agree staff navigation placement before exposing workflows. Retain access
   guards and run production-path access checks, not just isolated-host checks.
4. Complete integrated desktop/mobile staff workflow validation, including bulk
   actions, panels, drafts, sibling isolation and unexpected network requests.
5. Complete production build with approved nonproduction configuration and
   reassess remaining development-tooling findings without blind forced upgrades.
6. Review final diff, release evidence and rollback checkpoints before merging
   or publishing. Real contacts, live bookings and payments remain out of scope.