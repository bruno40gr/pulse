# Article AI Polish — revised local update, November 10, 2026

- Production activation, November 10–11, 2026:
  - Applied `202611090001_website_content.sql` to production
    (`jbrntsxmibfldocsuslt`) inside a transaction; recorded version
    `20261110234542` in `supabase_migrations`. Verified 4 tables, RLS on all 4,
    2 functions and `service_role` grants.
  - Imported the same 6 records with the production owner membership as actor
    (`website_content_command`, save then publish), revision 0 → 12. Verified via
    SQL and the live feed: 6 items, all published.
  - Set Vercel Production variables on project `pulse`:
    `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
    `WEBSITE_CONTENT_TENANT_ID`, `WEBSITE_CONTENT_READ_TOKEN` (new 64-hex secret,
    stored 0600 at `/Users/brunowong/pulse-backups/website-content-prod-20261111/`).
  - Redeployed. `https://app.headlinerma.com/api/website-content/public` returns
    401 without the token and the 6 published records with it.
  - Set `WEBSITE_CONTENT_API_URL` and the same token on Vercel project
    `headliner-app`, then deployed the website feed consumer. Live checks:
    homepage, all three article URLs and sitemap return 200; the calendar renders
    the current month (November 2026), confirming the live feed path rather than
    the fixed-date local fallback.
  - First two remote builds failed inside `next/font` fetching Baloo 2; a retry
    succeeded. No font or layout changes were made. A local prebuilt deploy is not
    possible because Vercel returns `[SENSITIVE]` for pulled secret values.
  - Outstanding: authenticated editor rehearsal (upload, publish, unpublish) in
    production; the old synthetic test article exists only in staging; the
    past-dated Halloween event is a notice, so production has no upcoming calendar
    events.

- Photo actions moved into the uploaded-image card (Replace photo / Remove photo);
  previously Remove stretched across the form and read like body text. Verified
  at 390px and 1440px.
- One-time content import completed November 10, 2026 into staging
  (`xpnygavujqmzkdmcktdm`), tenant `00000000-...-0001`, revision 21 → 33.
  Source: `scripts/export-website-content.mjs` (3 articles, 3 posters; 1 calendar
  event exported as a notice because it is past-dated). Every record was validated
  with `contentCommand` before writing; each was saved then published via
  `website_content_command` with the owning admin membership as actor. Article
  slugs were preserved (`student-performances-at-shadys-coffee`,
  `jennifer-belle-live-studio-session`, `wag-and-walk-with-placer-spca`). Verified:
  authorised feed returns 7 published records (the 6 imported plus the earlier
  test article), each article URL returns 200, homepage lists them, anonymous feed
  and private-asset requests return 401, and no imported image is an app-managed
  asset (they remain existing public Cloudinary URLs).
  Two follow-ups before production: the past Halloween event is now a notice, so
  the calendar has no upcoming events; and the older synthetic test article
  remains published in staging.

  `src/lib/websiteContent.js` fetches the CRM feed server-side with the reader
  token, or falls back to today's bundled preview content when
  `WEBSITE_CONTENT_API_URL` is unset. `app/page.js`,
  `app/publications/[slug]/page.js` and `app/sitemap.js` load per request
  (`dynamic = 'force-dynamic'`) instead of the static preview arrays;
  `HomePreview`/`PreviewEvents` accept injected content, use the academy's real
  date and render CRM event locations. `.env.example` documents the two
  server-only variables; `scripts/export-website-content.mjs` is the one-time
  exporter; `scripts/website-content.test.mjs` covers fallback, empty feed,
  mapping and failure.
- Release scope inventory (pulse worktree, all uncommitted): Website Content =
  `app/api/website-content/**`, `app/dashboard/website-content/page.tsx`,
  `app/content-studio-prototype/{ContentStudio.tsx,ArticlePolishField.tsx,studio.module.css}`,
  `components/ui/{ActionConfirmation,ConfirmActionButton,LoadingButton}.tsx`,
  `lib/{website-content,website-content-server,website-content-public,cloudinary-content,content-studio-prototype}.ts`,
  `middleware.ts`, `supabase/migrations/202611090001_website_content.sql`,
  `scripts/security/{website-content*,cloudinary-content,content-studio-prototype,synthetic-harness}.cjs`,
  and this document. Unrelated Community work to exclude: `app/api/community-posts/route.ts`,
  `app/dashboard/community/page.tsx`, `scripts/security/community-posts.test.cjs`.
  `app/dashboard/layout.tsx` belongs to Website Content (nav entry + admin-only gate).
- Full security suite: 759 of 760 pass. The single failure,
  `account-setup-recovery.test.cjs` → "lead automation boilerplate is removed but
  undo remains", is pre-existing on committed `main` (`LeadDetailPanel.tsx`
  contains no Undo at HEAD); it is unrelated to this work and was left untouched.
- Escalated hold button and shared confirmation copies come from the protected
  Odeon integration worktree. Only import style differs (`./LoadingButton`), so
  they must be reconciled when that line merges.

- Removed the staff-facing JSON import control and its unused handler. Browser
  checks assert the input/copy is absent. Scoped lint, TypeScript, 37 tests and
  intercepted 390px/1440px workflow checks passed after removal.
- Release inventory: Website Content edits currently live uncommitted in the
  pulse main worktree; the local origin/main tracking ref matches HEAD. The
  protected Odeon integration worktree remains separate. Headliner feed changes
  are also uncommitted on its main branch. Community edits must not be swept into
  the Website Content release. Housekeeping is deferred until after release;
  protected refs remain intact and destructive cleanup requires backup/recovery.

- Uploaded images now have a populated state with thumbnail, Photo uploaded,
  original filename and format, plus the shared Replace photo button. File details
  are validated and saved in the existing draft JSON (no migration); public feed
  projection does not expose them. Existing images without metadata retain their
  thumbnail and uploaded state without invented filenames. Artwork has the same
  populated treatment. Removing an image clears its metadata.
- Workspace uses shared SectionTitle (h2: Your Content), DenseSectionPanel cards
  with header actions, content-type badges and image/flyer thumbnails. Scoped lint,
  TypeScript and 37 unit/security tests passed. Intercepted 390px/1440px browser
  checks cover upload details, remove/reupload, save/reload persistence, old images,
  four content-type previews and publishing regressions. No production changes.

- Publication UI correction: removed the bespoke success card and duplicate
  HoldToCompleteButton. Reused Odeon's ActionConfirmation and ConfirmActionButton
  from the protected integration worktree, including LoadingButton's holdProgress
  support. The only adaptation to the hold component is its direct shared-library
  import. The action stays labelled Publish to Website; its async callback awaits
  the server. The shared confirmation displays the returned article title after
  success, and Done returns to the workspace. No Continue editing action or
  refresh instructions. Source worktree, Contacts and production remain untouched.
  Scoped lint, full TypeScript, 36 unit/security tests and intercepted browser
  checks at 390px/1440px passed (cancellation, keyboard completion, one pending
  request, busy state, server-gated modal/focus, conflict/editor retention,
  Done, save/reload, draft/live separation and removal). These are simulated API
  checks, not a production-delivery claim.

- Publication-status clarification: read-only staging query and live local feed
  both confirmed test article `d148f8f4-892e-4d83-a81d-9299d25ffc80` has a
  published snapshot and draft status `published`. No content state changed.
  Renamed the ambiguous Unpublish action to Remove from website. Connected list
  and editor now show explicit website status using `hasPublishedVersion`, not
  draft status alone; a saved draft with a published snapshot is labelled
  Published on website · draft edits not published. Draft-only and archived
  records explicitly say they are not on the website. The flag does not check
  expiry, delivery errors, or whether the user has unsaved editor changes.
  Validation: 36 unit/security tests, scoped lint, full TypeScript, and intercepted
  mobile/desktop save→publish→save-draft→remove browser checks passed. No
  production or staging article mutations were performed during investigation.

- Local website feed activated November 10: admin at `http://127.0.0.1:3000`
  and Headliner at `http://127.0.0.1:3001`. A freshly generated server-only reader
  token and Headliner tenant ID were configured in ignored local environment
  files, backed up with mode 0600 under
  `/Users/brunowong/pulse-backups/local-website-feed-20261110/`. Verified both
  admin database URLs remain staging-only before restarting the local server.
  Cloudinary values were reloaded into the process from the integration env;
  no production variables were pulled. No content records changed.
- Real staging feed returned one existing published article. Verified anonymous
  feed 401, authorised feed 200, homepage 200 with article title, article URL
  `/publications/test-article-d148f8f4` 200, and sitemap inclusion. Reader token
  absent from homepage/article HTML. Browser checks at 390px/1440px verified
  the actual title and all paragraph text, no broken images, no browser errors,
  and no horizontal overflow. Four Headliner feed tests passed. Screenshots:
  `/tmp/odeon-article-review/website-connected-{390,1440}.png`.
  The first browser probe used a guessed headline and did not match its case;
  the follow-up compared against the feed's actual title and passed.
- This verifies local/staging website rendering, not production activation,
  authenticated publish/unpublish transitions, or Cloudinary asset delivery for
  this article (its image did not use the new application asset URL).

- Staging setup follow-up: loaded the existing website repository guide from
  `/Users/brunowong/headliner-app/Headliner-Voice-and-Tone-Guide.md` (10,689
  characters) into Headliner's staging `tenant_settings.brand_markdown`.
  Both application database URLs were checked against staging project
  `xpnygavujqmzkdmcktdm` before writing. No settings row existed beforehand;
  inserted only tenant ID and the guide, then independently read back an exact
  match. Prior-state snapshot:
  `/Users/brunowong/pulse-backups/staging-brand-20261110/before.json`.
  No invented guidance, production database access, Contacts changes, or logo
  updates. This resolves the earlier missing staging-brand-guidance blocker.
- Preview Anthropic credential was rechecked as sensitive; no decryption or
  export attempted. A separately supplied development credential remains the
  blocker to real local generation. No paid AI calls, new keys, deployment,
  provider migration, or environment-file changes were made.
- Follow-up validation: 35 content/provider/writing tests passed. Intercepted
  mobile/desktop polish checks passed at 390px/1440px, and the real localhost
  generation endpoint returned 401 for an anonymous request. These checks do
  not establish authenticated provider generation or successful publication.

- Provider investigation: retained Anthropic; no OpenAI migration or billing
  setup. The installed Vercel CLI's normal `whoami` flow successfully renewed
  the expired saved login. A subsequent read-only metadata request confirmed
  `ANTHROPIC_API_KEY` on project `pulse` separately for Production and Preview,
  both sensitive variables, with no Development entry. Values were not revealed,
  decrypted, copied, or saved, and no hosted configuration was changed. This
  confirms hosted configuration, not provider balance, free usage, key validity,
  or a successful real generation. Local execution still needs an approved
  development credential plus staging brand guidance. Do not pull all production
  variables into localhost: local database clients must remain staging-only.

- Supersedes the earlier writing-assistant design below: the entire Help me write
  section is removed. AI Polish sits beside Short introduction and Full story,
  operates only on existing text in that field, and offers Undo polish. It does
  not generate a headline or change other article fields, save, or publish.
- The endpoint now accepts only `field: summary | body` and `text`, returns
  polished `text`, and uses saved tenant brand guidance. It preserves meaning
  and facts rather than expanding notes into a new article. Requests send only
  the selected field, not the rest of the article. Concurrent user edits are
  retained instead of being overwritten by a late response.
- Removed the requested instructional paragraphs and publication-scheduling
  explanation; Category now uses the exact requested “for example:” wording.
- Add a text link (optional) opens a collapsed link editor. The standalone URL
  field and its helper paragraph are removed from the main form; an address is
  still entered inside the optional link editor so links remain functional.
- Validation: 45 tests, scoped ESLint, full TypeScript, and whitespace checks
  pass. Intercepted 390px/1440px browser checks pass exact copy removals,
  empty-field disabling, per-field polish, undo, failure/concurrent-edit retention,
  collapsed link editing, no automatic writes and no horizontal overflow.
  Screenshots: `/tmp/odeon-article-review/polish-{390,1440}.png`.
- Existing setup blockers remain: provider key and saved staging brand guidance
  are not configured; real authenticated provider polishing is not verified.
  The per-process one-minute backstop is now per member and field so users can
  polish introduction and story independently; distributed budget limits remain
  a hosted-activation requirement. No Contacts or production changes.

## Earlier local implementation (superseded by AI Polish above)

- Article labels now use plain language with accessible helper text: Category,
  Short introduction, Date shown on the article, Optional link wording, and Link
  address. The date is not a publication schedule.
- Added Owner/Admin-only `/api/website-content/generate`, using the existing
  Anthropic SDK/model and tenant-scoped saved `brand_voice` / `brand_markdown`.
  Brand guidance is mandatory; missing guidance never silently falls back to an
  invented academy voice. No Contacts access, draft writes, or publish actions.
- Administrators supply confirmed facts, review a separate suggestion, and
  explicitly apply it. Replacing existing writing requires confirmation. Only
  headline, summary and body are replaced; dates, images and links are retained.
  Saving and publishing remain separate actions. UI discloses that notes and
  current article text are sent to Anthropic and reminds users about permissions.
- Request/output bounds, same-origin checks, private/no-store responses, a
  40-second provider timeout, and a per-member/per-process one-minute backstop
  are implemented. This backstop is NOT a distributed spending quota; shared
  rate limits/provider budget controls remain necessary before hosted activation.
- Setup check: main `.env.local` has no `ANTHROPIC_API_KEY`; Headliner staging
  tenant has no saved brand guidance. No credentials or brand settings changed.
  Real provider output and authenticated end-to-end generation remain unverified.
- Validation: 35 content/provider/writing tests passed; scoped ESLint, full
  TypeScript and diff whitespace checks passed. Isolated intercepted browser
  checks at 390px and 1440px passed suggestion review, cancelled/accepted
  replacement, retained links, error retention, no auto-save and no overflow.
  Artifacts: `/tmp/odeon-article-review/`. No production changes or deployment.
- Installed Next package does not contain `node_modules/next/dist/docs/`;
  changes follow the repository's existing route, authorization and UI patterns.

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
service-role-only RPCs, not a storage bucket. It was applied to Odeon staging on
November 10, 2026; production remains unchanged.

## Activation sequence

1. Review the Odeon release branch and unrelated pending changes separately. Verify
   deployment project/domain and database target before applying anything.
2. Rehearse the migration on an isolated database, then apply with deployment approval.
3. Configure Cloudinary credentials and the publishing tenant/reader token in Odeon.
4. Open the authenticated route as an Owner/Admin. Verify one draft upload, reload,
   preview, publish, edit-draft isolation, and unpublish. Verify another tenant/staff
   account cannot access the editor API or private images.
5. Decide which existing website content must be retained before enabling the
   feed. The staff-facing import control has been removed. Any one-time content
   migration requires a separately reviewed operator procedure; the export script
   alone does not populate the database. Review permissions, dates and attribution,
   and preserve article URLs. Never switch to an empty feed expecting local content
   to remain visible.
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

Current local verification on the approved main baseline: 28 scoped synthetic
tests, scoped lint, and full `tsc --noEmit --incremental false` pass. The broader
security suite passes 748/749 tests; the remaining source-string assertion in
`account-setup-recovery.test.cjs` expects `>Undo</Button>` in the unchanged
`LeadDetailPanel.tsx`, and that exact string is also absent from the HEAD version.
That unrelated baseline failure has not been changed or bypassed.
The added cross-repository contract test executes Odeon's public feed handler and
Headliner's loader against synthetic published rows, then an empty feed. It does
not execute the migration or command RPC. All 71 website tests also pass.
Earlier integration-worktree results: the Odeon production bundle compiles, but build type validation is blocked by the
existing custom props on `app/dashboard/contacts/page.tsx`; full `tsc` also includes
unrelated stale `previews/published-app` sources. Do not bypass those checks for a
production deployment. On November 10, 2026, the isolated editor browser review
passed at 390px and 1440px widths using a temporary Vite production bundle and
intercepted APIs. It checks draft reload, image rendering in final preview,
publish, conflict retention of edited text, draft/live snapshot separation, and
unpublish. This is not an authenticated Next.js route test or a real database or
provider test; authenticated admin browser verification remains outstanding.

Release preparation now uses the approved local main baseline `2b2f00e` in
`/Users/brunowong/pulse`. The Cloudinary content files replace the abandoned
Supabase-media implementation there. Main's Contacts table, dashboard layout,
middleware, and unrelated test-harness behavior are retained; no integration
sandbox routes or preview navigation changes were copied. The integration
worktree remains untouched on `5f7f638`. Before replacement, pending main work
was archived and refs bundled/verified under
`/Users/brunowong/pulse-backups/website-content-main-20261110-103539/`, with main
also preserved on a timestamped backup ref. No commit, push, or deployment was
performed. These scoped checks do not certify a deployable production release.

On November 10, 2026, after approval to use Odeon staging, a rollback-only SQL
rehearsal passed against `Odeon-staging` (`xpnygavujqmzkdmcktdm`). It created the
content schema and RPC definitions inside a transaction and checked RLS/client
privilege denial, service-role RPC grants, actor/non-admin/cross-tenant denial,
stale revisions, draft/live isolation, stable slugs, audit before/after snapshots,
asset format constraints, and publish/unpublish/archive. The transaction rolled
back; a separate query confirmed zero remaining content tables and functions.
That rehearsal did not persist schema or migration history. Subsequently, the
migration was installed in staging as described below.
This single-session test does not prove concurrent lock behavior or HTTP asset
authorization. No existing tenant, membership, or Contacts records were modified.

Staging connectivity is mixed: the dedicated read-only SQL endpoint timed out,
while the alternate SQL endpoint succeeded, including read-only probes. Service
health reported Auth, REST, DB and several other checks unhealthy despite the
project list reporting healthy. Resolve/verify application connectivity before
interpreting any authenticated browser failures as content implementation bugs.

The approved main app is now running locally at `http://127.0.0.1:3000`, with
both database clients verified to target Odeon staging. Its login page and staff
listing return 200, anonymous content API access returns 401, and the editor
redirects anonymous visitors to login. A later direct staging Auth health probe
returned 200; the REST probe without a signed-in user returned 401. Cloudinary
credentials are loaded into this dev process from the integration worktree's
ignored local file; they were not copied into tracked source or main's env file.
After restarting the server, load them again before testing uploads. The schema
is now installed in staging: migration name `202611090001_website_content`,
recorded version `20261110184833`. Follow-up catalog checks verified RLS on all
four content tables, no anon/authenticated SELECT grants, and service-role-only
RPC execution. A read-only call through the application's configured Supabase
client successfully returned revision 0 with an empty item list. This resolves
the missing-schema blocker but is not authenticated browser save/publish proof.
No content was created by that read check. No Community posts migration or
production configuration was changed.

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