# Beta promotion review — November 14, 2026

## Scope and decision

Preserve the complete recent Beta implementation on the existing integration
line, rather than copying the older prototype tree or replacing newer main code.
Scope includes calendar and booking, enrollment completion and portal projection,
bands and ensembles, setup/scheduling/rooms, shared interaction/layout controls,
standalone onboarding, workspace switching, and sample-parent impersonation.

Initial promotion review was blocked by tests/build. Both are now passing after
the November 15 validation/configuration repairs recorded below. Final release
impact/access review and refreshed backup/merge gates still apply.
No merge, push, deployment, database migration,
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

### November 15 repair (supersedes failing-test counts below)

- **Configured production build passed, exit 0**, including page-data collection
  and static generation. Root cause was missing worktree-local configuration,
  not absent credentials. Main's existing `.env.local` targets documented staging;
  six Supabase variables were copied into a new owner-only (0600), Git-ignored
  integration `.env.local`. No secrets are in this document or commit; no
  production credentials, placeholder values, migrations or database writes.
- Post-configuration tenant-selection, academy storage and Settings checks:
  88/88 passed. Docker was installed but its daemon was stopped; no Docker
  operation or backup restoration was necessary for the build repair.
- Full domain/security run: **1,099 passed, zero failed**. The 12 previous failures
  were reconciled against intended current behavior and history, not suppressed.
  `bb023f0` explicitly removed the automatic-status notice/Undo; it was not a
  regression to restore. Settings mocks now use the account-context loader and
  retain authorized/unauthorized deep-link checks, with added failure/unmount
  cases. Transport, effect-dependency, token and toolbar assertions reflect the
  existing shared implementations.
- Focused suite: 39/39 passed. Changed-test lint, TypeScript and diff checks pass.
- Completion regression uses the actual localStorage snapshot and retains
  sessionStorage for the workflow queue. All identity, payment, amount, lesson,
  membership, parent visibility and no-operational-API assertions remain intact.
  It now runs at 1440px and 390px; mobile uses the existing navigation menu.
- Final browser runs passed at both 1440px and 390px: sample card enrollment,
  pay-later enrollment, student/lesson projection and parent-portal visibility;
  band creation and paid membership confirmation/projection; calendar controls;
  six-destination navigation; onboarding/workspace round trips; contextual
  impersonation and exit/reload. Scripts reported no operational API requests or
  runtime errors; navigation/calendar/impersonation also checked overflow.
- The first expanded mobile run timed out looking for a hidden sidebar link.
  Opening the existing mobile menu fixed the harness; the complete six-case
  enrollment/band rerun passed. No runtime navigation behavior was changed.
- Historical pre-configuration build reattempt compiled and passed types, then failed collecting
  `/api/account/email-signoff`: `supabaseUrl is required`. Nonproduction
  configuration was then a blocking gate. The later configured build above
  completed successfully and supersedes that failure.
- Product direction is documented in `docs/Odeon-AI-vision.md`, with explicit
  instructions to flag over-polishing in `AGENTS.md`.

### Historical initial review

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
2. Completed: production build using existing documented staging configuration.
   Keep environment files private and environment-specific; build success does
   not prove deployed configuration, live schema or live transaction readiness.
3. Rerun desktop/mobile calendar, enrollment/band completion, navigation and sample
   impersonation tests, plus production-path authorization checks. Isolated-host
   tests do not prove deployed middleware or live-session access.
4. Review the final impact and rollback checkpoint. Refresh live remote refs and
   backup/recovery evidence, preserve main's pending working state, then promote
   the reviewed integration to main and push main without rewriting history.
5. Delete only the verified merged integration branch/worktree, after recovery
   gates and content checks. Protected Odeon refs and unmerged work remain intact.