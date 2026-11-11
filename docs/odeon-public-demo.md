# Odeon fictional school sandbox

## UI correction

The standalone card-based demo has been removed. `/odeon-demo` now composes the **existing** `DashboardLayout`, dashboard `ContactsPage`, `StudentWorkspaceV3` family/student drawer, dashboard `StaffPage`, `StaffSlidePanel`, `ParentPortal` and `SchoolSetup`. The only preview-specific chrome is a small sample-data notice and the family selector. No alternate stylesheet or card layout remains.

Sample-data inputs bypass fetch effects for these components, not server authentication. Existing live consumers keep their original fetch behavior. Real imports/sync, bulk edits/messages and global add/enroll buttons are disabled in this sandbox rather than making live requests. Existing in-drawer local management remains available.

`lib/odeon-demo-workspace.ts` adapts the seed into the app's existing family/enrollment/invoice/makeup contracts. Invoice unit amounts are net of the best discount; original rates, discounts and class dates appear in invoice notes. All 15 families work in the existing parent portal. The adapter marks original missed lessons absent and carries the same credits into both staff and parent views.

Current state key: `odeon:app-sample:v2` in session storage. The first card-based demo's storage is not read. There is no reset button in the app shell; clear this key or open a fresh browser tab for a fresh seed. School Setup remains its own existing full-page layout, not a nested demo card surface.

## Entry points

- `/odeon-demo`: real Contacts table and family/student drawers.
- `/odeon-demo?screen=staff`: real Staff table and staff slide panel.
- `/odeon-demo?view=parent&account=demo%3Afamily-1`: existing parent portal; selector covers all families.
- `/odeon-demo/school-setup?experience=configured`: existing School Setup editor seeded from the same fictional school.
- New account remains a separate empty experience.

These pages now require an authenticated owner/admin membership through middleware and are marked noindex with private, no-store responses. The live sidebar exposes them under BETA only after its existing account-role check. Direct URLs use the same server-side role gate. No dashboard, existing prototype route or API authentication was relaxed. The sandbox imports no database, messaging or payment client. All names and email addresses are fictional; emails use `example.invalid`.

## Dataset

Fixed review date: November 9, 2026. Billing months: September and October 2026, without closures. Timezone: America/Los_Angeles.

- 10 teachers, 15 families, 26 students. Seven single-student, five two-student and three three-student families.
- Weekly private piano, guitar, Voice & Vocals (one service), drums and bass; 30 minutes, $40/class. Levels 1–3 available.
- Tiny Keys ages 5–7 (45 min), Little Rockers ages 3–5 (30 min), Band (60 min). $35/student/class.
- Monday–Friday noon–9pm, Saturday 9am–3pm, Sunday closed. Teachers have a subset of these working days.
- Multiple-instrument learners, mixed private/group families, an adult learner, two-guardian family and three staff households.
- 30 simulated paid invoices: one consolidated invoice per family per month, charged upfront on each month's first day. Quantities count actual dated occurrences (four or five), not a four-week approximation.
- 10% sibling discount on all private/group enrollments in households with two or more active students. 50% staff-household discount. Best single discount; never stacked. No taxes or fees.
- Six available makeup credits, including private and group students, linked to original paid October lessons. Credits expire April 1, 2027. Original occurrences remain in invoice coverage, not charged again.

## Interactions and boundaries

The family drawer and parent view use the same student/enrollment/invoice/credit identities. Parent mode selects one family before rendering its data; this is a public simulation, **not a secure parent portal**. Everyone with the sandbox URL can select any fictional family. No real data should ever be put into this dataset.

Existing local family/student management supports its original save/cancel flows. Sandbox data changes use `sessionStorage`, isolated to a browser tab; there is no server persistence. Onboarding and the app adapter share the initial identities/catalog; subsequent teacher/service configuration edits do not rewrite the existing enrollment snapshots.

The onboarding editor uses shared teacher/service IDs and the same initial prices. Configured record edits persist during navigation in the same tab. Other onboarding state (discount drafts, policy, curriculum, new-school work) retains the editor's in-memory behavior and resets when leaving/reloading. Configuration changes do not regenerate schedules, enrollment terms or issued invoices. The initial invoice snapshots always retain their original amounts and names in the seed remain the reference catalog. The header explains this limit.

The existing makeup workspace checks available teachers against the fictional catalog, school hours, student/teacher/room conflicts and the sample expiry. It uses the existing preview clock of November 3, 2026. Group makeups use an individual catch-up appointment in this demo; it is not a production group-capacity/rebooking policy. The existing app calendar handles booked replacements. No notifications, live payment attempts, real attendance writes or invoice generation jobs run.

## Validation

```sh
node --test scripts/academy/odeon-demo.test.cjs scripts/academy/school-setup.test.cjs
npm run test:academy
npx tsc --noEmit
npx eslint app/odeon-demo lib/odeon-demo.ts lib/odeon-demo-setup.ts scripts/academy/odeon-demo.test.cjs scripts/security/odeon-demo-browser.cjs app/content-studio-prototype/school-setup/SchoolSetup.tsx app/content-studio-prototype/school-setup/setup-content.ts middleware.ts
git diff --check
```

Browser regression uses existing Playwright tooling via `PLAYWRIGHT_MODULE` and optionally `PLAYWRIGHT_EXECUTABLE_PATH`, against `ODEON_DEMO_URL` (default `http://127.0.0.1:3198`). It checks desktop/mobile drawers, profile editing, selected-family isolation, makeup booking, onboarding, session persistence, no application API calls, and anonymous protection of real staff routes/APIs.

## Hosting

The pages are production-capable Next routes; no development-only gate. Deploy with the application's normal secured environment. The production host still requires its existing server environment variables because middleware imports existing server modules. Never put service-role credentials in a browser bundle.

No deployment is performed by this change. Once deployed, append `/odeon-demo` to that deployment's origin. Do not share a localhost URL with remote reviewers. Do not tunnel the whole development server as a substitute for a properly deployed sandbox.

## Beta release status — November 10, 2026

Implemented locally: owner/admin-only BETA menu entries for Academy sandbox and
School setup, server-side access checks on all sandbox subpaths, tenant-preserving
menu links, sample-data banners, and synthetic role/tenant access tests.
No deployment or production alias change has been performed.

Release blockers: the integration working tree includes unrelated unfinished
changes. Full-app TypeScript currently fails on unsupported custom Next page/layout
props and the local two-source preview host's nonportable imports/dependencies.
The narrower published-preview TypeScript check is not a production build check.
Prepare a scoped release artifact, extract reusable page/layout implementations
behind valid route wrappers, exclude the local host from the production build,
and preserve the published Contacts/enrollment implementation before deployment.
Do not disable build validation or deploy the entire dirty workspace.

Beta iterations: publish the current sample workflows first; calendar day/week,
filters and add-lesson workflow, booking/payment foundation, self-booking links,
and marketing conversion remain subsequent roadmap increments. Each increment
needs validation before release to Beta; live financial enablement is separate.

## Scoped staged release — November 10, 2026

`scripts/academy/prepare-beta-release.py --output <new-absolute-directory>` exports
checkpoint `2b2f00e` and copies the sandbox dependency closure under `beta-source`.
Its separate namespace preserves published Contacts and enrollment implementations.
Reusable Contacts/Staff/dashboard implementations are not Next route modules.
No preview-host imports, environment files, migrations, or unrelated dirty features
are included. `beta-release-manifest.json` records the dependency inventory.

Artifact prepared at
`/Users/brunowong/.cline/data/workspaces/chat/odeon-beta-release-20261110`.
Vercel deployment `pulse-h4neca4uc-bruno40grs-projects.vercel.app` is Ready following
a full production build and Next type validation. It was created with
`--prod --skip-domain`: **no existing live domain alias was promoted**.
The first build encountered a Google font fetch/loader failure; retry succeeded
without changing fonts or disabling validation. Existing build configuration skips
lint; targeted artifact lint was separately run and passed.

Verified: isolated artifact TypeScript; 51 setup/security tests; 173 tenant,
validation and enrollment regressions; 15 middleware role/tenant cases against
the artifact; 34 published Contacts checks; desktop/mobile policy browser checks
against the local preview (not the hosted artifact). Hosted anonymous School Setup
request returns 307 to login with tenant context preserved, through `vercel curl`
because Vercel Authentication protects the deployment hostname.

The integration synthetic harness had lost its `syntheticAIText` override, causing
a false Contacts search regression when substituted into the artifact. Restored
that existing fixture behavior; baseline Contacts implementation was unchanged.

**Promotion remains blocked** on real hosted owner/admin, staff and cross-tenant
sessions, hosted desktop/mobile smoke checks, and verification that sample
navigation retains tenant context and performs no live operational writes.
Do not equate synthetic middleware cases or local-preview checks with those gates.

## Beta polish release — November 10, 2026

`scripts/academy/prepare-beta-release.py` exports published `main` at
`BASE_COMMIT` (now `f48fd3a`, the Website Content publishing release), so a
rebuild contains the membership-login repair, the Beta gate and every published
feature instead of replacing them. Both patches are idempotent: a rebuild from a
checkpoint that already carries the gate leaves it alone.

Bump `BASE_COMMIT` — or pass `--base <sha>` — to the current `main` HEAD before
every rebuild. The Beta pill is a state read from `/api/account/me`, so the
builder anchors that state on the sidebar's own `conversationCount` declaration
and fails loudly if the anchor is missing; anchoring on the neighbouring
`usePathname()` line silently produced a build without `canAccessBeta`, which
made the pill vanish.

Changes in this release:

- One mustard `BETA` entry at the end of the dashboard nav replaces the BETA
  group. The builder emits the same entry into the published layout.
- The sandbox keeps the standard Headliner logo in the desktop sidebar, mobile
  drawer and mobile top bar; no `odeon.` wordmark remains.
- `Back to Headliner` is the single red exit, used on the School Setup top bar
  and in the parent portal. The School Setup exit preserves `tenant`.
- The parent portal drops the interactive-preview disclaimer and uses the
  logo-on-white asset configured for the Headliner tenant.
- School Setup → Calendar sits on the same white panel as other sections.

Artifact: `headliner-beta-polish-20261110`. Deployment
`dpl_CQJKG6s7D9NEh6B9WH3YgDqcLrSj` is Ready, carries `alias: app.headlinerma.com`
with `aliasAssigned: true`, and is the newest production deployment — it replaces
the plain `main` build `dpl_MjTnF7ejtLxBThwg6B41ALSirpoz` that had taken the
domain after the Website Content release. Verified: artifact TypeScript, targeted
lint, 28 setup/security tests, and the Beta browser check at 1440 and 390
(official Contacts table, stripes/hover, no indent, V3 panel, Headliner logo, red
exits, three destinations, tenant preserved, no operational API calls). The known
lead-panel "Undo" copy assertion still fails on the unchanged baseline.

Any later push to `main` builds without the overlay and re-takes
`app.headlinerma.com`, removing the pill; rebuild and redeploy this artifact after
such a release, or fold the overlay into `main` to make it permanent.

Contacts now render the published page, not a release-branch copy. The builder
declares `app/dashboard/contacts/page` and
`components/contacts/ContactPrototypeContext` as `PUBLISHED`: when a sandbox
import resolves to one of them the module is referenced in place and the base
archive serves it, so `DemoWorkspace` renders the same `ContactsPage` the live
dashboard renders (striped rows, shared hover overlay, no member indentation,
family/student views) and shares one React context instance with it. The sandbox
feeds fiction through `ContactSampleContext` and routes name clicks back into
`StudentWorkspaceV3`, so no live slide panel opens and no operational call runs.
Imports are rewritten per specifier, so any other module still mirrors into
`beta-source` as before.

Deployment `dpl_27zHCNr7xJu33XtwV5QdeozYmD3Y` is Ready, aliased to
`app.headlinerma.com`, and carries `import ContactsPage from
'@/app/dashboard/contacts/page'` in the deployed `beta-source` with no
`beta-source/app/dashboard/contacts` copy. `scripts/security/beta-official-contacts-browser.cjs`
passes at 1440 and 390 on that build.
