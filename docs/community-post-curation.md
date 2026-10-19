# Headliner Desk: community-post curation

Status: manual curation implemented locally; migration and staging acceptance pending.
Added October 11, 2026. Homepage UI is locked; no website changes in this CRM slice.

## Local implementation checkpoint

- Dashboard workspace: `/dashboard/community`; API: `/api/community-posts`.
- Access currently uses the existing `tenant_settings.manage` permission (owner
  access remains supported). No demo or unauthenticated access; tenant derived
  through verified membership, never a default tenant.
- Add/canonicalize/deduplicate URLs, staff review, approve/archive/return to inbox,
  feature/unfeature and reorder up to four posts.
- Migration: `/Users/brunowong/pulse/supabase/migrations/202610110001_community_posts.sql`.
  Server-only tables/functions, atomic edits and audit snapshots, per-tenant
  revision conflicts. Not applied to any database in this task.
- Synthetic route/domain tests: `/Users/brunowong/pulse/scripts/security/community-posts.test.cjs`.
  Tests, TypeScript check, scoped lint, existing tenant-selection tests and build pass.
- Still pending: staging SQL execution and transaction/concurrency tests, real
  authorized staff browser acceptance, preview-image/metadata editing, public
  approved-only output and website data integration. No social imports or uploads.
- Database audit exists but a staff audit-history viewer is not implemented.
- Do not run older verification scripts against live data just to test this feature.
  Use an isolated staging environment with synthetic tenants and memberships.

## Goal

Let authorized staff curate four community posts for the Headliner homepage.
Automate discovery where permitted, not editorial approval. The current website
mockup uses four directly rendered official embeds; do not replace that approved
presentation with generic “Load post” cards without a separate design approval.

## Phase 1: manual curation

- Inbox, approved pool, four ordered homepage slots, and archive.
- Paste an original Instagram/TikTok URL; validate its platform, canonicalize it,
  and deduplicate it. Never accept arbitrary embed HTML or script URLs.
- Separate approval from featuring; permit fewer than four approved posts without
  inserting duplicates or stretching remaining tiles.
- Staff can feature, reorder, unfeature, and archive; log actor and changes.
- Track platform, URL, source, editorial status, homepage order, actual publication
  date when verified, contributor attribution, and review/permission notes.
- Optional preview image and alt text must come from authorized staff or a permitted
  API. Record provenance and permission separately from permission to embed.
- Review child/guardian permissions and appropriateness before featuring family
  content. A public mention is a candidate, not automatic permission or endorsement.
- Enforce CRM tenant/role authorization. Public website output contains approved
  display fields only, never permission notes, credentials, or inbox candidates.

## Phase 2: assisted discovery

- Investigate official own-account post import and eligible mention/tag discovery.
- Verify current Instagram/TikTok access, account eligibility, app review, scopes,
  age restrictions, quotas, and supported attribution before committing to coverage.
- Do not promise every mention, follower-post enumeration, or automatic captions.
- Imports enter the inbox only; staff approval remains mandatory.
- Secure credentials server-side; handle disconnect/revocation, deduplication,
  pagination, rate limits, retries, and auditability.
- No scraping, arbitrary thumbnail extraction, downloaded social video rehosting,
  or assuming public media can be reused as custom previews.

## Phase 3: optional approved-pool rotation

Staff may pin posts and opt into rotation from the approved pool. Discovery alone
must never publish a post. Unavailable posts should have original-link fallbacks
and a staff removal/replacement workflow.

## Website integration and acceptance

- Preserve the selected four-post direct-embed presentation for now; this project
  documents future authorized previews but does not mandate click-to-load UI.
- Use official embeds with accessible titles, no autoplay, and original links.
- Do not crop embedded captions by hiding overflow or tamper with platform content.
- Test desktop/mobile, keyboard behavior, unavailable posts, and variable captions.
- Test denied CRM access, tenant isolation, deduplication, homepage ordering, and
  exclusion of unapproved/private fields from public output.
- Account integrations remain future work. Local schema/route implementation does
  not mean deployed functionality; no credentials or live CRM records were changed.