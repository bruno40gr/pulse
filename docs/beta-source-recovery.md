# Beta source recovery

The work-area navigation deployment exposed a release-source gap: earlier Beta
pages had been deployed from an artifact but had not been integrated into main.
Middleware still protected the URLs, so anonymous login redirects did not prove
that the pages existed.

Recovered the sample-only `beta-source` dependency tree and `/odeon-demo` route
wrappers from `/private/tmp/hb-art8`, along with missing service images. Existing
official Contacts preview context support already matched that artifact and was
not replaced. The protected integration worktree was neither copied nor modified.

The mustard BETA / Academy preview link is restored above Settings in the shared
desktop/mobile sidebar, visible only for owner/admin `roleKey` values. Middleware
continues to enforce administrator and tenant authorization. `/beta` now redirects
to `/odeon-demo` preserving query parameters. No database, Auth or membership changes.

Validation: TypeScript and targeted lint pass; 75 scoped tests pass, including
anonymous/staff/cross-tenant denial and owner/admin access. Isolated browser checks
at 1440px and 390px pass the role-filtered entry button, sample Contacts, V3 family
workspace, Parent portal, School Setup, tenant-preserving alias and exit navigation.
The sample workflow browser test observed no operational API calls. Browser checks
use synthetic identity responses, not an impersonated production owner session.

These recovered source files are committed alongside the navigation so future
deployments from main retain Beta without an external release-artifact overlay.