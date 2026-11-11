# Odeon lightweight website-content CRM

## Scope

`/dashboard/website-content` hosts the existing Content Studio inside Odeon.
Owner/Admin access is enforced by middleware and each API handler. Demo/sample
navigation never offers publishing access. The original prototype remains separate.

Content metadata, private drafts, published snapshots, revisions, and audit records
live in the application database. Images upload through the signed Cloudinary API,
not Supabase Storage. No new SDK dependency is required.

New Cloudinary images use authenticated delivery so draft uploads do not become
public accidentally. The admin image endpoint verifies tenant membership. The public
image endpoint only streams assets referenced by a current, non-expired published
record. Signed Cloudinary requests and secrets remain on the server.

## Admin workflow

- Announcement/flyer: upload finished artwork, describe it, preview, publish to board.
- Event: title, date, Pacific-local time, location, artwork; board and calendar placement.
- Deadline: date and artwork; board and all-day calendar placement.
- Article writer: headline, summary, category, editorial date, cover photo and alt text,
  credits, paragraph body, optional HTTPS attribution/action; story cards and full page.
- Save draft preserves the current published version. Publish replaces that snapshot.
  Unpublish/archive removes the public version. Conflicting revisions return 409.
- Article URLs are generated once and retained on edits. Imported stories keep their URLs.

Social curation remains in the existing Community posts feature. Generated poster
templates and print/export remain prototype-only, not production publishing claims.
The article writer is manual composition, not an AI-writing integration.

## Configuration (server environment only)

```
CLOUDINARY_CLOUD_NAME=diy08lj9x
CLOUDINARY_API_KEY=<configure in hosting secret manager>
CLOUDINARY_API_SECRET=<configure in hosting secret manager>
WEBSITE_CONTENT_TENANT_ID=00000000-0000-0000-0000-000000000001
WEBSITE_CONTENT_READ_TOKEN=<random shared secret of at least 32 characters>
```

Never put API secrets or the reader token in `NEXT_PUBLIC_*` variables. Existing
database auth/service-role configuration is reused. The migration is
`supabase/migrations/202611090001_website_content.sql`; it adds content tables and
service-role-only RPCs, not a storage bucket. It has not been applied by this task.

## Activation sequence

1. Review the Odeon release branch and unrelated pending changes separately. Verify
   deployment project/domain and database target before applying anything.
2. Rehearse the migration on an isolated database, then apply with deployment approval.
3. Configure Cloudinary credentials and the publishing tenant/reader token in Odeon.
4. Open the authenticated route as an Owner/Admin. Verify one draft upload, reload,
   preview, publish, edit-draft isolation, and unpublish. Verify another tenant/staff
   account cannot access the editor API or private images.
5. From the website repository run `node scripts/export-website-content.mjs` and save
   the output as JSON. Import it via the admin import control. This imports private
   drafts and skips existing deterministic IDs; it does not publish automatically.
   Review past flyers, article text/image permissions, dates, and attribution before
   publishing. Repeated imports must not overwrite existing editorial changes.
6. On the website configure `WEBSITE_CONTENT_API_URL` to the deployed Odeon origin's
   `/api/website-content/public` and set the matching server-only reader token.
   Do this only after the intended content has been reviewed and published.
7. Verify homepage, article URLs/metadata/sitemap, calendar, image delivery, and
   unpublish on the actual website. No code commit should be needed for future edits.

The website retains local content only while the feed URL is unset. Once enabled,
an empty feed stays empty; it never resurrects unpublished local records. Feed errors
fail rather than silently restore removed material. Roll back configuration only as
an explicit editorial decision since local records may include removed content.

## Limitations and validation gates

Current local verification: 28 scoped synthetic tests pass and scoped lint passes.
The added cross-repository contract test executes Odeon's public feed handler and
Headliner's loader against synthetic published rows, then an empty feed. It does
not execute the migration or command RPC. All 71 website tests also pass.
The Odeon production bundle compiles, but build type validation is blocked by the
existing custom props on `app/dashboard/contacts/page.tsx`; full `tsc` also includes
unrelated stale `previews/published-app` sources. Do not bypass those checks for a
production deployment. On November 10, 2026, the isolated editor browser review
passed at 390px and 1440px widths using a temporary Vite production bundle and
intercepted APIs. It checks draft reload, image rendering in final preview,
publish, conflict retention of edited text, draft/live snapshot separation, and
unpublish. This is not an authenticated Next.js route test or a real database or
provider test; authenticated admin browser verification remains outstanding.

Release baseline inspection: the integration worktree remains on `5f7f638` with
mixed unrelated uncommitted changes. Local main at `2b2f00e` contains the newer
Contacts table with optional context-driven V3 navigation; do not replace that
table with the integration preview route. A content-only release should be
prepared separately against the approved application baseline, retaining its
Contacts implementation. Neither inspected worktree is certified deployable by
these scoped checks. No baseline switch or commit was made during this review.

On November 10, 2026, after approval to use Odeon staging, a rollback-only SQL
rehearsal passed against `Odeon-staging` (`xpnygavujqmzkdmcktdm`). It created the
content schema and RPC definitions inside a transaction and checked RLS/client
privilege denial, service-role RPC grants, actor/non-admin/cross-tenant denial,
stale revisions, draft/live isolation, stable slugs, audit before/after snapshots,
asset format constraints, and publish/unpublish/archive. The transaction rolled
back; a separate query confirmed zero remaining content tables and functions.
The migration has not been persistently applied or recorded in migration history.
This single-session test does not prove concurrent lock behavior or HTTP asset
authorization. No existing tenant, membership, or Contacts records were modified.

Staging connectivity is mixed: the dedicated read-only SQL endpoint timed out,
while the alternate SQL endpoint succeeded, including read-only probes. Service
health reported Auth, REST, DB and several other checks unhealthy despite the
project list reporting healthy. Resolve/verify application connectivity before
interpreting any authenticated browser failures as content implementation bugs.

- Cloudinary unit tests remain mocked. A separate real-provider check passed on
  November 10, 2026 using the locally configured account and the actual upload and
  download helpers: credential ping, authenticated PNG upload with a unique ID
  and overwrite disabled, signed asset-ID download with PNG-byte verification,
  and denial of unsigned authenticated/public delivery URLs. One tiny synthetic
  private asset was retained under `odeon-staging-verification/20261110/`; no
  existing assets were changed or deleted. A sanitized local record is stored at
  `/tmp/odeon-cloudinary-provider-20261110.json` (temporary, not a durable audit).
  This does not verify the authenticated editor, application asset authorization,
  database persistence, publishing, or unrelated CRM integrations.
- Unpublishing stops new access through the application; it cannot revoke copies a
  visitor already downloaded. Existing imported Cloudinary public URLs remain public.
- Upload metadata failure can leave a private unattached provider asset; the server
  logs its immutable asset ID for reconciliation. There is no automatic destructive
  cleanup job.
- The initial writer supports paragraphs and retained imported body images, not a
  full rich-text editor. Social publishing, AI writing and print rendering are out of scope.
- A successful live admin-to-website publish/unpublish rehearsal is required before
  handing the editor to staff. Local tests do not constitute deployment verification.