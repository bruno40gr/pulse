# Tenant-selection repair — October 4, 2026

## Scope and status

Implemented locally, not deployed. This closes the reviewed default-tenant paths; it is **not** certification of all route authorization or completion of Phase 1.

The affected contacts, staff, campaigns, history, inbox, insights, settings, recipient search, media suggestions, tenant metadata, and campaign-copy handlers now use `lib/tenant-request.ts`. The existing `lib/tenant-access.ts` resolver also stops using its compatibility default argument. `/api/tenant` returns only the verified selected school, not the entire tenant directory.

## Rules

- Query/body tenant values are selection requests, never authorization.
- Omitted selection resolves the identity's sole eligible membership. Ambiguous membership requires selection; it never selects Headliner by default.
- Staff requests require a valid school membership and the declared permission where applicable.
- Supported legacy access still works for eligible memberships with legacy access enabled. No password changes, account claims, or secret rotations are part of this repair.
- Allowed demo operations use only the tenant in the signed demo session. Demo campaign creation remains available; contact import/create are staff-only.
- Conflicting, duplicate-conflicting, empty, and malformed selections are rejected.
- Verification errors deny access with a generic retryable error before domain operations.

## Validation

Run `npm run test:tenant-selection` from `/Users/brunowong/pulse`.

Tests execute actual TypeScript helpers/handlers with synthetic identities and database responses. Network, real provider calls, and environment-file loading are blocked. This verifies application control flow—not production RLS, live credentials, browser behavior, real SQL semantics, or production latency. CSV tests use the installed Papa Parse implementation, including populated mapped rows through the import handler for personal and legacy identities. They verify grouping, family/student separation, school-scoped insert payloads, attendance normalization/order, and response counts. Mocked writes do not prove SQL persistence or constraints.

Also run TypeScript and `git diff --check`. Targeted helper/test lint passes. Existing touched-handler `any` lint debt is outside this repair's scope.

## Before deployment: staging checklist

### Local preflight — October 4, 2026

- Only `.env.local` was found; no explicitly identified staging environment is configured locally. Existing database credentials were not used or tested, and their target was not assumed safe.
- No Vercel/Supabase CLI or browser-test runner was available in the inspected workspace. No preview deployment, browser smoke test, membership query, or latency measurement was performed.
- Populated synthetic CSV checks are automated alongside the existing tenant-selection suite. The first run exposed an incorrect test assumption about attendance ordering; the handler intentionally returns date-descending order and the test now checks that contract.
- **Gate remains open:** provide an isolated staging deployment running this working tree, with synthetic records and representative personal/legacy accounts. Do not use a preview that inherits production database/provider credentials. Confirm both primary and CRM targets are isolated and SMS/AI provider side effects are disabled before testing.
- On that deployment, complete the checklist below; record HTTP errors, observed records/counts, and before/after loading timings. Never provide credentials in chat—use an approved local secret file or interactive browser session.

- [ ] Confirm representative Headliner users have eligible memberships and correct roles/permissions; include a personal account and supported legacy account.
- [ ] Load contacts, staff, inbox/counts, history, and settings; verify search results and response shapes.
- [ ] Create a contact and campaign; mark an inbox thread read.
- [ ] Import a synthetic populated CSV, including mappings, without a tenant query parameter.
- [ ] Check demo browsing/composition remains inside demo data; verify demo import is denied.
- [ ] Verify a synthetic other-school user cannot access Headliner by missing, explicit, conflicting, or invalid selection.
- [ ] Check settings and loading/error states on desktop/mobile.
- [ ] Measure representative loading latency before/after; additional authorization queries may add latency.
- [ ] Verify the deployment artifact includes new helper files and regression tests pass.

## User-visible effects and limitations

No CSS/components, database schemas, data partitioning, search-filter syntax, or session-signing configuration changed. Existing records are not moved or deleted by this repair. Valid staff should not have to reclaim accounts. Missing/inactive memberships, missing permissions, stale tenant selection, or verification outages now return access/retry errors rather than silently querying Headliner.

Other legacy authorization helpers and remaining route defaults still require separate review. In particular, this does not retire `canAccessTenant` globally, change public intake/webhooks, fix related-record ownership across every route, or address dependency advisories. Continue the roadmap; do not treat this patch as external-school launch approval.