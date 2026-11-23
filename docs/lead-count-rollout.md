# Lead notification count correction

## Production status

Retained by the subsequent family-layout deployment
`dpl_1oLVrR9SiLeeGZEMdVpTHP8fdPEq`, READY on `app.headlinerma.com`.
The deployment below is the original count-correction release, not the current alias.

Deployment `dpl_42XfJHizodLFFC75n61cHhycgU1g` is READY and verified as serving
`app.headlinerma.com`. Production build and database/configuration guard passed.
Canonical unauthenticated smoke: Leads page 307 to login, count-only and
summary-only APIs 401. Actual staff-session counts were not inspected or changed.

## Rule

Sidebar and red Lesson requests / Service inquiries tab badges share
`getNewLeadCounts`: only status `new`, created less than 24 hours ago, and not
future-dated. The window reuses `NEW_LEAD_WINDOW_MS` from the existing table
highlight rule. Existing-person opportunities, legacy contact-band opportunities
and win-back imports remain excluded. Status transitions immediately stop
counting; note/activity edits never restart the creation window.

Muted tab totals retain their existing category/status semantics and do not
expire with notification badges. A visible open Leads page refreshes nonzero
badges every minute; focus and edit notifications also refresh summaries.

## Release provenance

Snapshot: `/private/tmp/pulse-lead-count-release-20261120`, based on production
`dpl_8osQRZJWdjMW99SELaegEPUbggjo` from
`/private/tmp/pulse-account-manager-release-20261120`. Exactly five follow-up
files are allowlisted and SHA-256 recorded in `lead-count-release-files.json`.
Unrelated dirty checkout work is excluded. No migrations, lead record changes,
email sends or git commit/push are part of this correction.

## Validation

Isolated TypeScript and all 173 lead regression tests passed, including exact
24-hour expiry, future/missing dates, recent edits on old inquiries, status
changes, unchanged totals, tenant isolation and sidebar/tab count parity.
Targeted lint had zero errors and 36 existing unused-variable warnings.
This document was updated in the original checkout after deployment.