# Beta promotion review — November 14, 2026

## Scope and decision

Preserve the complete recent Beta implementation on the existing integration
line, rather than copying the older prototype tree or replacing newer main code.
Scope includes calendar and booking, enrollment completion and portal projection,
bands and ensembles, setup/scheduling/rooms, shared interaction/layout controls,
standalone onboarding, workspace switching, and sample-parent impersonation.

Promotion to `main` is blocked. No merge, push, deployment, database migration,
branch deletion or worktree removal was performed by this review. The integration
checkpoint is not a release approval. Temporary preview-host dashboard adapters
are outside Git and are not part of the application artifact; production uses
the repository's actual dashboard routes.

## Recovery evidence

Backup directory:
`/Users/brunowong/pulse-backups/beta-promotion-20261115-082011`.
Its filesystem timestamp uses the host clock; the review date follows the session
date. All refs were bundled and all four worktrees archived. Recovery restored
all five local branches and replayed 21 main, 77 detached-review, 199 integration,
and 132 prototype source-file hashes. `recovery-verified.txt` records PASS.

A second hash-verified bundle lives at
`/Users/brunowong/odeon-private/pulse-branch-backups-20261115-082011/beta-promotion-20261115-082011.bundle`.
Both copies are local, not offsite backups. Ignored private configuration is in
the private archives only, never staged into Git. The first archive invocation
failed because its parent worktrees directory was missing; it was created and
the complete archive/recovery drill rerun successfully before proceeding.

## Validation and blocking gates

- Full domain/security suite: 1,097 tests, 1,085 passes, 12 failures.
- Seven failures reproduce on archived main's working state: lead Undo-copy,
  Settings description/tab layout, and five Settings email-location/access tests.
- Integration-specific failures: two close-control tests with a missing
  interaction-token harness mock; Contact insights transport source assertion;
  Contacts toolbar source contract; Leads effect-dependency source assertion.
  These require explicit reconciliation and rerun, not suppression.
- TypeScript: passed (`npx tsc --noEmit`).
- ESLint over edited and new code: zero errors, warnings remain.
- Whitespace/diff check: passed.
- Fresh desktop/mobile browser runs passed six-destination navigation and
  onboarding/workspace round trips plus contextual impersonation/exit/reload at
  1440px and 390px, with no reported API leaks, runtime errors or overflow.
- The fresh enrollment/band completion browser script failed at line 77 reading
  `snapshot` from a null persisted value. Completion is therefore not revalidated
  by this review; investigate fixture/storage compatibility and rerun.
- Production build: compilation and type validation passed; page-data collection
  failed for `/api/account/access` with `supabaseUrl is required`.
- Approved nonproduction Supabase configuration is required to complete the build.
  Do not substitute production secrets or claim compilation equals a full build.

Evidence logs are copied into the private backup's `validation` directory; `/tmp`
copies are convenient but are not the durable record. Browser outcomes are
recorded there separately and must not be inferred from historical screenshots.

## Next release steps

1. Resolve the failing contracts against actual behavior without regressing main
   or weakening security/access assertions; document baseline issues explicitly.
2. Complete the production build using approved nonproduction configuration.
3. Rerun desktop/mobile calendar, enrollment/band completion, navigation and sample
   impersonation tests, plus production-path authorization checks. Isolated-host
   tests do not prove deployed middleware or live-session access.
4. Review the final impact and rollback checkpoint. Refresh live remote refs and
   backup/recovery evidence, preserve main's pending working state, then promote
   the reviewed integration to main and push main without rewriting history.
5. Delete only the verified merged integration branch/worktree, after recovery
   gates and content checks. Protected Odeon refs and unmerged work remain intact.