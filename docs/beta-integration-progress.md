# Beta integration progress — November 13, 2026

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