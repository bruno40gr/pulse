# Beta Contacts/navigation repair — 2026-11-10

Isolated successor of the successful secondary-login release. No Auth, membership,
admin, migration or RLS changes. Do not deploy the dirty integration worktree.

Beta Contacts now wraps the official Contacts page using a fictional-data context,
not a duplicate table. Preserves shared preferences, zebra/hover and unindented
names. Sample name navigation remains StudentWorkspaceV3. Sample operational
fetches, import, sync, enrollment navigation and bulk messages are disabled.
Normal authenticated Contacts has no sample context and retains existing behavior.

Sample navigation uses Headliner branding, removes the Staff link and fictional
academy name, and exposes Back to Headliner preserving tenant. School Setup
also exits to Headliner and retains unsaved-change confirmation.

Validation: TypeScript, targeted lint, 31 Contacts/access tests passed. Isolated
browser host at 1440/390px passes official Contacts zebra/hover, aligned names,
V3 opening, navigation/tenant, no overflow, no runtime errors, and no operational
API calls. School Setup makes read-only account identity requests. The isolated
host excludes middleware only for local rendering; release middleware unchanged.
Actual hosted Owner/staff/cross-tenant sessions are not impersonated or claimed.

Rollback: promote dpl_FG3qWXYCiF4TGJ9nz9aqgSiQZw5Y (account repair retained).
Maintained-source integration remains outstanding; this artifact must not be lost
in the next release-builder run.

Production deployment dpl_6FqF9iFD6fXTJjHtFt39Th2vTJtb passed build and was
promoted to app.headlinerma.com. Official authenticated Contacts browser
regressions passed at 1440/900/390px with intercepted fictional fixtures.
Additional tests: 38/39 passed; the remaining lead Undo-copy assertion also
fails on the unchanged prior artifact (reproduced). Total targeted tests 69/70.
