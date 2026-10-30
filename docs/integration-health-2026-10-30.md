# Odeon / release integration checkpoint — October 30, 2026

## Safety boundary

- Original workspace: `/Users/brunowong/pulse`, local main at `400081f` with uncommitted work. Left unchanged.
- Verified backup: `/Users/brunowong/pulse-backups/odeon-before-integration-20261030-105257`.
- Backup snapshot: `45fe7f3964a9fa8d218df127a24b0b89465bb3a3`; archive and snapshot checked against SHA-256 file manifest. Repository bundle verified.
- Integration workspace: `/Users/brunowong/pulse-odeon-integration`, branch `integration/odeon-release-20261030`.
- Baseline: `eaf283d086e9926709184a370b67088ce41c04f9`, matching the remote release branch when inspected. This is not independent confirmation of Vercel's currently served commit.
- No deployment, database migration, remote push, main update, or release-worktree modification.
- Local dependencies are reused through a node_modules symlink; environment files and Vercel linkage were not copied.

## Integrated so far

1. Three enrollment commits (`b014a1b`, `64046e2`, `72d9038`) cherry-picked onto release without conflicts.
2. Snapshot's Odeon prototype, academy domain/rehearsal, documentation and tests restored by explicit allowlist.
3. Shared UI primitives and contact styling copied only after confirming their release baseline exactly matched the old committed baseline. These are review candidates, not approved production deployment changes.
4. Release sidebar layout, lead count, hidden-tab polling, Gmail sync/store logic, and newer lead/editor behavior retained.

## Production-overlap reconciliation — October 30 follow-up

- Ported Add lead name + valid mandatory email, optional phone, and Save-only validation to the release form. Initial fields remain neutral; failed submission shows inline and top/bottom errors, focuses and scrolls to the summary, and blocks the network request. New forms reset submission state. Queued receipts still block resubmission.
- Manual `pulse-manual` intake applies the same email rule before database access. Public website phone-only intake and durable capture responses remain supported and tested.
- Kept the release `LeadStudent` contract, explicit self/contact confirmation, student-owned channels, birthday handling, preferences, availability sharing and payload adapters. Added shared FieldGrid layouts and borderless Add-lead student fieldsets without replacing the editor.
- Ported card-title variants without changing heading semantics, shared communication action bar, container-responsive follow-up fields and consistent desktop peer-card gutters. Preserved release inline editor/header continuity and independent follow-up actions.
- Reviewed snapshot conversation and Gmail deltas: release already includes channel toggles and converted-lead capture. Its channel filter additionally retains on-demand email-history entry points. No changes made to `Conversations.tsx`, `conversation-display.ts`, or Gmail rules/sync; leases, deadlines, range loading and store logic retained.
- Extended offline tests for validation/API boundaries and release-adapted layout contracts. Gmail settings VM harness now stubs CSS-module class names so it can render the real shared controls; existing assertions retained.

### Validation at this checkpoint

- Academy: 203 passing tests (`/tmp/odeon-integration-academy.log`).
- Lead/intake/layout focused pass: 45 passing tests (`/tmp/odeon-integration-lead-port.log`).
- Broader release regression pass: 362 passing tests across 37 files, including the focused tests, Gmail/settings/sync, conversation/email store/ranges, lead/student/editor/follow-up/notes/lifecycle/order/count and visibility-aware polling (`/tmp/odeon-integration-release.log`). Counts overlap; do not add the focused count again.
- TypeScript: `tsc --noEmit --incremental false` passed (`/tmp/odeon-integration-types.log`).
- Targeted ESLint: zero errors, 35 existing unused-code warnings in lead views (`/tmp/odeon-integration-lint.log`). `git diff --check` passed.
- The installed Next package has no `node_modules/next/dist/docs/` directory. Inspected its README and existing route/component conventions; no framework API changes introduced.
- No authenticated browser verification, production deployment provenance check, or production build completed in this pass. Integration worktree has no copied environment files or Vercel linkage. Offline tests are not evidence of deployed behavior.

## Remaining gates — do not overwrite with snapshot files

- `components/leads/LeadStudentsEditor.tsx`: release has a richer shared Add/Edit editor with `LeadStudent` contracts, contact/self confirmation, own channels, relationship, birthday and preferences. Snapshot uses a different request-draft contract. Preserve release model and merge UX deliberately; do not substitute one for the other.
- Validate narrow/wide authenticated lead/contact layout, error-summary focus/scroll, Notes alignment and conversation channel controls in a browser. Do not infer visual parity from static layout assertions.
- Old local commit `400081f` was not cherry-picked: release contains later lead ordering and note-author fixes; replaying it produces conflicts and risks regression.
- Snapshot's full UI regression suite assumes the older lead structure and must be adapted, not copied wholesale or weakened to ignore release behavior.

## Next gate

Browser-check authenticated narrow/wide surfaces against the verified production deployment before choosing a deployment or main-reconciliation plan. Run a configured production build as part of that gate. Keep Odeon future work distinguishable from production fixes in commit history. No push, deployment, database operation or main/release-worktree update authorized by this checkpoint.