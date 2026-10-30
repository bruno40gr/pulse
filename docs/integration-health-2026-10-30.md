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

## Pending reconciliation — do not overwrite with snapshot files

- `components/leads/LeadStudentsEditor.tsx`: release has a richer shared Add/Edit editor with `LeadStudent` contracts, contact/self confirmation, own channels, relationship, birthday and preferences. Snapshot uses a different request-draft contract. Preserve release model and merge UX deliberately; do not substitute one for the other.
- Lead detail/list: retain release lifecycle tabs, inline editing/header continuity, status controls, follow-up editing and ordering. Port shared card titles, action bar, gutters, field grids and deferred validation as separate reviewed changes.
- Add-lead email-required validation and scroll-to-summary behavior remain only in the backup/original workspace pending a port to the release form. They are not implemented by this checkpoint.
- `components/inbox/Conversations.tsx` and conversation-display changes: compare channel-toggle work against release email-store/loading/date-range changes before porting.
- Gmail rules/sync/tests: local converted-lead capture appears partly represented in release; retain release leases, deadlines and store behavior and compare semantic deltas rather than copying old files.
- Old local commit `400081f` was not cherry-picked: release contains later lead ordering and note-author fixes; replaying it produces conflicts and risks regression.
- Snapshot's full UI regression suite assumes the older lead structure and must be adapted, not copied wholesale or weakened to ignore release behavior.

## Next gate

Finish production-overlap ports in this isolated worktree; run academy, shared UI, lead/editor/follow-up/notes, polling/count and Gmail/email-store regressions. Browser-check authenticated narrow/wide surfaces against the verified production deployment before choosing a deployment or main-reconciliation plan. Keep Odeon future work distinguishable from production fixes in commit history.