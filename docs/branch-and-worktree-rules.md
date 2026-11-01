# Branch, worktree and backup rules

These rules exist because parallel copies of the same code made it impossible to
tell which version was real. They apply to this repository from 2026-10-31.

## Rules

1. **One worktree per active line.** Keep `main` plus at most one active release
   line. Remove a worktree as soon as its work is merged. Do not keep a worktree
   per experiment.
2. **No micro branches.** A typography, spacing, signature or copy fix rides the
   line that is shipping. Create `fix/*` or `feature/*` only for work that is
   genuinely independent and expected to live longer than a day.
3. **Merge and delete together.** When a branch lands, delete it in the same step,
   so merged branches never accumulate.
4. **`main` stays pushed.** Never leave `main` ahead of `origin/main`. If it is
   ahead, push or park the commits on a `backup/*` ref before doing anything else.
5. **Back up before destructive git operations.** Before deleting branches,
   removing worktrees or running `gc`, create a bundle of all refs and archive the
   uncommitted work of every affected worktree. Follow the convention in
   "Backup layout" below.
6. **The recovery drill is a blocking gate.** Nothing is deleted until a drill has
   restored every branch from the bundle and re-applied an archived patch into a
   scratch checkout. A failed drill means no deletions.
7. **Never run `git gc --prune=now`.** The default windows (unreachable objects 2
   weeks, unreachable reflog entries 30 days) are the safety net for a mistake.
   Prune immediately and the net is gone.
8. **Never force-push a shared branch and never rewrite history.** If history looks
   wrong, add a commit; do not rewrite it.
9. **Protected work.** `integration/odeon-release-20261030` and
   `backup/odeon-before-integration-20261030-105257` hold the Odeon vision work.
   They are never deleted, renamed or rewritten. Odeon pulls from the source of
   truth; the source of truth does not absorb Odeon without explicit review.
10. **Source of truth.** `main` is the single source of truth. Work is developed on
    one release line and merged into `main`; afterwards the release branch is
    deleted and `main` is pushed.

## Backup layout

Location: `/Users/brunowong/pulse-backups/<operation>-<date>/`

```
pulse-all-refs-<date>.bundle      # every ref, including protected branches
local-refs.tsv                    # branch, sha, tip date
remote-refs.tsv                   # remote refs at backup time
worktrees-before.txt              # worktree list before the operation
stashes-before.txt
archive-worktrees.sh              # the script that produced the archives
recovery-drill.sh                 # the blocking gate
worktrees/<name>/
  status-before.txt               # porcelain status at archive time
  tracked-work.patch              # staged + unstaged tracked changes
  index-work.patch                # staged changes only
  working-files.tar.gz            # untracked + ignored files (no node_modules/.next)
  manifest.txt                    # branch, head, counts, sizes
manifest.md                       # the operation record and decisions
```

An offsite copy of the bundle lives under
`/Users/brunowong/odeon-private/pulse-branch-backups-<date>/` so a failure of the
repository directory itself is survivable.

## Recovery

```bash
# restore every branch into a scratch repo
git init /tmp/restore && cd /tmp/restore
git fetch /path/to/pulse-all-refs-<date>.bundle '+refs/*:refs/backup/*'

# restore one branch by name
git branch <name> <sha-from-local-refs.tsv>

# restore a deleted worktree's uncommitted work
git worktree add /tmp/restore-wt <sha>
git -C /tmp/restore-wt apply /path/to/worktrees/<name>/tracked-work.patch
tar -xzf /path/to/worktrees/<name>/working-files.tar.gz -C /tmp/restore-wt
```

## Current state after the 2026-10-31 hygiene pass

- Local branches: `main`, `fix/restore-lead-signal-column`,
  `integration/odeon-release-20261030`,
  `backup/odeon-before-integration-20261030-105257`.
- Worktrees: `/Users/brunowong/pulse`, `/private/tmp/pulse-lead-signal-release`,
  `/Users/brunowong/pulse-odeon-integration`.
- Backup set: `/Users/brunowong/pulse-backups/branches-hygiene-20261031/`
  (recovery drill passed).
