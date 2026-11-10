# Published app, fictional data

This local host renders `/Users/brunowong/pulse/app/dashboard/contacts/page.tsx`
and its actual dependencies, not the older Contacts implementation on the Odeon
integration branch. The dashboard and enrollment pages also import the source
directly. Published Contacts has an optional context-based name-open hook; the
preview provides it to open the existing integration V3 workspace. Without that
provider, live Contacts retains its existing panel behavior. Table markup and
styles are unchanged. Components, lib and public are symlinks
to `/Users/brunowong/pulse`; this is a local review host, not a portable deployment.

Run `npm run dev` from this directory. Open
`http://127.0.0.1:3199/odeon-demo` (redirects to `/dashboard/contacts`).
The old port 3198 preview is not this version.

API fixtures provide fictional Contacts records. V3 uses `createDemoWorkspace`
for the same student/account IDs and owns its existing in-memory mutations.
Webpack resolves imports by source tree so V3 retains its integration dependencies
without replacing published table or enrollment dependencies. `check.cjs` applies
the same resolution for TypeScript validation.
The host has no production API routes, middleware or
environment files. Unknown API reads return 404 and writes return 403. Enrollment
is the published local five-step implementation; its save is in-memory and does
not create a real subscription, persist a new Contacts record or charge anyone.
Name clicks open **Family workspace V3**, not the published legacy Contact panel.
Other sidebar pages are not mounted here. Reload resets V3 in-memory changes.

Validation: `npm run check` and `node verify.cjs` (set PLAYWRIGHT_MODULE and
PLAYWRIGHT_EXECUTABLE_PATH if needed). Browser assertions cover desktop blue
hover, family selection, no viewport overflow, student-name V3 opening in both
views, account-holder V3 opening in Families view, Billing/Makeups, closing and
reopening, invoice isolation across two families, enrollment through Times, and
no page errors or provider requests at 1440px and 390px. They do not establish a
completed enrollment or working live writes.