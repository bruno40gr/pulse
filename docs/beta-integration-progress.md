# Beta integration progress — November 13, 2026

## Domain and screen reconciliation checkpoint

Reconciled Beta enrollment, band, program, opportunity and workflow models under
`beta-source/lib`. The portal actions, queue, store and hook live there together;
Parent enrollment consumes that same hook. There is no copied root queue/store.
This remains fictional same-tab session transport, not authorization or payment
infrastructure. Parent family selection projects queued accounts into the sample
workspace; request drafts can open, save and resume without operational writes.

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

## Dependencies

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
no successful full build claimed. Sharp installation/runtime is not proven by
the dependency audit alone; validate actual image processing before release.

## Shared component promotion

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

## Checks

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

Reconcile the Beta domain/store/workflow dependency graph with `beta-source`,
retaining one shared portal queue instance and main's newer family calendar and
Reschedule together. Resolve the staff-workspace navigation placement before
exposing it. Preserve operational Contacts/Leads defaults while adding simulated
adapters. Complete build/image/browser/access validation, resolve or explicitly
assess remaining tooling findings, then review the integration diff before merge.
Real contacts, live booking and payments remain outside this release.