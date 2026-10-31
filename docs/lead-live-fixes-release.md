# Lead-only release candidate — October 29, 2026

Baseline: `5a89a4672d9de775b4b58c76c30eb5da523050ef`, the reported deployed revision and current remote `fix/auto-load-selected-email-range` tip. Read-only Vercel metadata rechecked October 29 confirms the canonical `app.headlinerma.com` alias and project production target both point to Ready deployment `dpl_8wNDJvRFTMJCkEoJ9P8F7VrZtVLb`; its `gitCommitSha` reports this baseline. Source is `cli`, so metadata does not prove the upload had no uncommitted changes. Sanitized evidence: `/tmp/pulse-lead-live-production-metadata.json`. Remote `main` remains `b4aff2169e719277b4c9caa4e9e42d8b41b87fb7`; therefore this branch contains already-shipped family/email history absent from main. Review the candidate delta against its baseline, not as a small PR against main.

## Candidate scope

- Source-independent newest-first lead ordering by default; inquiry filters, lifecycle tabs, explicit column sorting, and optional Action first remain intact.
- Original blue `#EAF2FF` highlight for creation age from zero up to, but not including, 24 hours. Invalid/future dates are not highlighted. Expiry refreshes while the page stays open; existing selection styling takes precedence. Older rows retain family-table stripes.
- Original-author-only note editing, including for owners. Original author/time are retained; edits append revisions, reject stale saves using serialized JSONB payload equality, and do not replay status automation or mentions. Unknown/imported authors, inquiry messages, application messages, and generated labels remain read-only.
- Note authors resolve from tenant-scoped recorded person IDs. Lorena's specific production note/avatar still needs an authenticated smoke test.

No conversation-store code, scheduler changes, Gmail migrations, or configuration changes are included in the candidate delta. Existing Gmail behavior from the baseline is intentionally preserved.

## Validation

- 531 security tests pass: `/tmp/pulse-lead-live-tests.log`. Added membership-authenticated route regressions for author/non-author access with both assistant and owner roles, plus a rejected concurrent JSONB update. Authentication/database responses are synthetic; these are not deployed-session smoke tests.
- TypeScript passes: `/tmp/pulse-lead-live-types.log`.
- Optimized build passes with local-only Supabase values: `/tmp/pulse-lead-live-build.log`. This does not verify production configuration.
- Browser harness passes at 1440, 900, and 390 pixels: `/tmp/pulse-lead-live-browser.log`. Covers newest-first ordering, manual/website highlighting, live expiry, family grouping, explicit sorting, optional Action first, and absence of writes. Uses isolated rendering of this worktree with intercepted APIs; not production data or end-to-end authorization.
- Targeted UI/helper/test lint: zero errors, 35 existing unused-code warnings. API route lint has 16 explicit-any errors both at baseline and integrated candidate; no increase. Full targeted lint is therefore not clean.
- Diff whitespace checks pass.

## Before deployment

Reconfirm the actual production revision and inspect the complete candidate delta. Run authenticated preview smoke tests for author/non-author editing, stale conflicts, inquiry filtering, and Lorena's actual note/avatar. Preserve newer family UI. Do not deploy the older main-based lead-fix branch over the newer baseline. Deployment approval and effective production configuration checks remain separate; this candidate has not been deployed and requires no database migration.