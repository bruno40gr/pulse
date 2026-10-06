# Next-session handoff — October 4, 2026

## Production status

- User reports current production commit is `8b42b7f`.
- User has not redeployed. New environment settings must not be assumed active.
- Confirm `PULSE_SESSION_SECRET` and `PULSE_SYSTEM_PASSWORD` were saved for Production before redeployment. Never share or print their values.
- User elected to retain the existing short shared password despite the documented risk. Use a separate strong random session secret.
- Redeploy the existing production revision through Vercel; do not push the local working tree as part of activating environment settings.
- Signing-secret activation invalidates legacy/demo cookies. Personal-account passwords do not change.

## Local verification completed

- `npm run test:tenant-selection`: 74 tests passed, zero failed or skipped.
- Includes populated mapped CSV handler execution for personal and legacy Headliner identities.
- Tests use synthetic dependencies, not a live database. They do not establish SQL constraints, persistence, production behavior, browser layout, or real latency.
- `tsc --noEmit --incremental false --pretty false`: passed.
- `git diff --check`: passed.
- No deployment, commit, push, provider calls, or live database access performed.

## When back at the computer

1. Confirm the two Production authentication variables are saved.
2. Redeploy the existing `8b42b7f` production deployment to activate them.
3. Verify login and contacts, Leads, and inbox loading. Do not expose secret values in screenshots.
4. Continue staging setup separately. Do not change live database URLs or retire the CRM project.
5. Before deploying the tenant repair, validate representative memberships, populated imports against an isolated database, browser workflows on desktop/mobile, and actual loading latency.

## Boundaries

- Current local changes include both the tenant repair and pre-existing Headliner feature work. Preserve both; do not blindly revert or deploy everything.
- The tenant repair remains local and is not external-school launch approval.
- Webhook signing, public intake overwrite, secret-fallback removal, and dependency remediation remain separate work.
- Reference `docs/tenant-selection-repair.md` and `docs/foundation-roadmap.md` for scope and release gates.