# Bruno secondary login and Beta release — 2026-11-10

Deployment `dpl_FG3qWXYCiF4TGJ9nz9aqgSiQZw5Y`
(`pulse-5lzkh9wd5-bruno40grs-projects.vercel.app`) promoted successfully.
`app.headlinerma.com` resolves to this Ready deployment. Previous deployment:
`dpl_FeoCTNAdvypNRs9xbWjeY6vu9ALr` at commit `af1e667`.
Artifact base `2b2f00e` differs by optional Contacts preview context hooks only.

Added a service-managed secondary-login table, explicit Gmail link, and audit
event. Primary admin Auth user and membership unchanged. No new person or
instructor; staff contact email unchanged. Migration tested on staging first.
No Auth passwords, tokens, or confirmation state were manually changed.
Gmail was already email-verified before linking.

Shared membership resolver, middleware, personal settings and password-reset
access now recognize explicit additional login links. Name-based login accepts
an optional sign-in email, validated against the selected staff membership.
Recovery resolves explicit secondary email links without email-based auto-grants.
Provider errors return a generic 503; missing accounts remain enumeration-safe.
Reset screen distinguishes verified-but-unlinked access from missing sessions.

Validation: TypeScript and targeted lint pass; 762/763 security tests pass.
The remaining lead-panel Undo copy assertion also fails on unchanged baseline.
Production build passed. Hosted anonymous Beta redirects to login preserving
tenant. Live login and staff roster return 200; Bruno W. appears as claimed.
Recovery POST returned 200 and Auth recovery_sent_at advanced to
2026-11-10 22:24:17 UTC for Gmail only; admin recovery timestamp unchanged.

Pending: user completes newest reset email and verifies actual Owner-session
Beta navigation and desktop/mobile workflows. No real staff or cross-tenant
hosted sessions were impersonated; those restrictions were tested synthetically.
No live payment/message smoke actions performed. Beta remains sample-only.

Rollback: promote previous deployment if needed, and revoke the secondary link
by setting revoked_at. Additive schema can remain. Preserve audit events.

Work isolated in this artifact folder; neither shared dirty source worktree was
deployed wholesale. Changes are not committed or merged and must be integrated
into the maintained source/release builder before a later release to avoid loss.