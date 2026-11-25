# Scoped admin release — November 25, 2026

## Approved scope

Owner approved deploying admin improvements separately to main, without calendar/Services changes.
This release starts from main a62acba3a46a12f8d51a2dfa371466ed69a74324 and includes only recorded relationship badges, staff mention entry, shared follow-up modal/persistence integration and regression evidence.
The profile/email composer, School Setup template management and note-to-task retirement are not part of this release. Notes, task history and conversion remain available.

## Production prerequisite

Only shared migration 202611240005 is installed and verified. SHA-256: 73f9116ec19a6228d8f546b0ee3c67ce5cceb6469bccf1122b586a5ff6cd6d73.
Private verified recovery and migration evidence: /Users/brunowong/odeon-private/backups/backup-Xf4538/.
Production postflight: 196 unchanged inquiries, 1,596 unchanged lead events, 42 open unlinked reminders and 42 history snapshots. No guessed identity linking.

## Isolation and checks

- No release-branch merge: its six commits include 153 unrelated paths. None are included wholesale.
- Calendar and Services migrations, code and in-progress working files excluded. Their integration-worktree file hashes remained unchanged before commit.
- Existing main worktree held the original bounded admin patch; retained that patch, updating only installed migration version/ACL correction and its PostgreSQL rehearsal.
- Shared-file review/verified archives and full-ref bundle: /Users/brunowong/pulse-backups/admin-scoped-deploy-20261125-000358.
- Scoped TypeScript passed. Forty focused Node tests passed. PostgreSQL service/browser roles, destructive-default ACL refusal and failed-migration atomicity passed.
- Modal browser checks passed 1440x1000, 390x844, 844x390; Contact follow-up browser checks passed 1440px and 390px. Synthetic intercepted APIs only; no real sends/writes.
- Full scoped suite: 1,071 pass, 17 fail; pristine-main comparison reproduced every failure (plus an archive-only website fixture path failure). No new full-suite failures. Existing failures are Gmail fixture dependency mocks and brand-color assertions, not claimed passed.
- Targeted UI/API lint: zero errors, existing warnings. Leads route has previously recorded baseline lint errors; no unrelated lint cleanup.

## Deployment and recovery boundary

Enable NEXT_PUBLIC_ENABLE_SHARED_FOLLOW_UPS only for the approved production release build. Public flag is build-time, not an immediate runtime switch.
Capture deployment/commit/alias evidence after build. Read-only production checks first; no production synthetic write test or messaging authorized by this deployment request.
Previous production deployment dpl_F6wDP3i8bvDZ7cbDEjWKN5UNWWE9 has old Won-clearing semantics: not a semantic rollback guarantee. Preserve shared tables/history and compatibility triggers; no automatic DROP/full-database restore. A rollback needs Won operations suspended or a reviewed forward fix.
The calendar/Services line must later reconcile this main commit rather than replacing shared files wholesale. It retains newer subscription/family/Notes behavior independently; this scoped release neither deletes nor promotes that work.
