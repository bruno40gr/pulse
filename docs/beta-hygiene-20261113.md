# Beta documentation and repository hygiene — November 13, 2026

## Scope

Document the integration's decisions/corrections and durable principles, remove
only demonstrably merged local branches, and preserve active/uncommitted work.
This pass does not merge Beta, publish it, change operational routes or finish
the dirty staff Explorer integration.

## Documentation

- `docs/integration-principles.md` records improve-not-overwrite principles,
  shared experience reuse, destination data ownership, explicit simulated
  transport, one queue/store, release checks, honest status and safe hygiene.
- `AGENTS.md` and `docs/component-reuse-directives.md` link/enforce that guidance.
- `docs/beta-integration-progress.md` now has one current status section and
  labels historical evidence/checkpoints rather than implying old gaps remain.

## Branch audit and action

Live remote heads were queried during this pass. Main and origin/main both
pointed to `9d5c5ccd7007dae36b75f7621e7079717de9b8c2`; main was neither ahead
nor behind its tracked remote. The working integration checkpoint was `17d958e`.

| Ref | Decision | Evidence/reason |
| --- | --- | --- |
| `backup/website-content-main-20261110-103539` | Deleted locally with `git branch -d` | Tip `2b2f00e9f71dc263a25b6b077c61a92ee0b99f7b` is an ancestor of main; no checked-out worktree; backup/recovery gate passed. |
| `main` | Retained | Source of truth; checked out in original main worktree. |
| `integration/beta-20261113` | Retained | Active, unmerged integration with unfinished working changes. |
| `explore/events-and-booking` | Retained | Active prototype, checked out and dirty; not merged into main. |
| `integration/odeon-release-20261030` | Retained | Explicitly protected repository rule. |
| `backup/odeon-before-integration-20261030-105257` | Retained | Explicitly protected repository rule. |
| `origin/fix/lead-order-author-only-notes` | Retained remotely and locally as tracking ref | Tip `34d94d0` is not an ancestor of main. `git cherry` reports its patch equivalent in main, but patch equivalence is not a completed merge/approval to delete shared remote work. |

No remote branches were deleted. No force deletion, reset, stash drop, history
rewrite or garbage collection was performed. Worktree-prune dry run found no
stale registrations. The detached review worktree and original dirty worktrees
were retained, not silently removed to satisfy a numeric worktree limit.

## Blocking backup/recovery gate

Backup location:
`/Users/brunowong/pulse-backups/beta-hygiene-20261113-153432`.

- All refs saved in `pulse-all-refs-20261113.bundle`, with local/remote ref,
  worktree and stash inventories.
- All four existing worktrees archived: tracked patches, staged patches,
  untracked/ignored source files and SHA-256 manifests. Dependency/build outputs
  such as node_modules and .next were excluded. Archives can contain private
  ignored configuration and remain in the private backup directory, never Git.
- Source hashes verified on replay: main 21 files; detached review worktree 77;
  Beta integration 26; original prototype 132. These are snapshot file counts,
  not counts of tracked modifications or tests.
- Every local branch was restored into a disposable recovery repository, and
  all archived working states were replayed and hash-checked. Initial drill
  attempts failed on scratch-repository HEAD and Python tar API compatibility;
  no deletion occurred until the corrected drill completed successfully.
- `recovery-verified.txt` records the passing gate. Reproduction scripts and
  logs are stored alongside the bundle.
- Second bundle copy:
  `/Users/brunowong/odeon-private/pulse-branch-backups-20261113/beta-hygiene-20261113-153432.bundle`.
  Its SHA-256 matched the primary. Both copies are local, not offsite backups.

## Remaining hygiene / iteration guidance

- The integration is deliberately **not clean**: unfinished staff-screen edits
  remain separate from this documentation checkpoint. Do not commit them merely
  to make status look tidy, and do not overwrite/drop them during cleanup.
- Main's original dirty files and prototype changes remain untouched. The
  existing stash `pre-promotion park 20261031` remains retained.
- Prefer the integration worktree for current Beta iteration. Avoid parallel
  microbranches and more duplicate stores/directories. Release exceptions should
  end with deliberate merge/recovery/cleanup, not premature deletion.
- Retain protected Odeon work indefinitely as directed by repository rules.
- Recheck remote state and recoverability at the next cleanup; this inventory
  is a dated snapshot, not permission for future destructive operations.