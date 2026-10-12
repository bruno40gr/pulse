# Content Studio — prototype-first review

## Current shared wizard (supersedes the earlier iteration notes below)

All five types now use one numbered Details → Design → Publish wizard and one sticky Back/Next footer. Content Studio returns to the creation homepage from any step and retains current edits in the session workspace; Back on Details does the same. Browser-storage failure still falls back to memory.

Events, deadlines and announcements share one visual template picker, contrast-based black/white logo, text-only banner CTA, optional supporting photo, and finished-artwork upload. Supporting photos and finished artwork use independent fields. Older session drafts retain their upload fallback. Articles keep image-led story composition and optional HTTPS story links; social posts keep original-post links, permission confirmation and the four-featured-post limit. Both use the same wizard and style-reference upload without inappropriate poster controls.

Supporting photos default to Separate: a dedicated image zone follows the text/brand area, without cropping the image. Overlay is an explicit radio option: the photo fills the backdrop, with content on a solid palette-colored panel. Uploaded photos replace illustrative icons. Text regions grow rather than overlap; this is deterministic layout protection, not AI subject/focal-point detection or final print text-fitting. References remain local review materials, not training or automatic template generation.

Scoped lint, TypeScript, production build and 12 synthetic tests passed. Loopback browser checks exercised all five flows at 1440px and 390px, incomplete-step validation, return-and-retain, independent artwork/photo uploads, five poster treatments in both photo modes, simulated publication and no horizontal overflow/runtime errors. The real route remains account-administrator protected; live authenticated route review and production publishing/export are still outstanding.

Local route: `/content-studio-prototype`. This isolated route is not in dashboard navigation. Middleware uses the existing account-administrator check (Owner/Admin); the public homepage is unchanged.

## Reviewable flows

- Event: details, academy-local time, artwork, digital or printable + digital, automatic Calendar and Bulletin Board placement.
- Deadline: all-day calendar item and Bulletin Board placement, distinct from an event.
- Announcement: Bulletin Board placement with optional expiration.
- Article: supplied image and accessible description required for simulated publication, full-story preview, optional CTA on the full story only.
- Social: direct Instagram/TikTok URL validation, permission confirmation, optional authorized preview image, maximum four published featured selections.

Three locked illustrative template treatments use existing crimson, teal, and yellow tokens. Printable mode previews US Letter portrait proportions. Typography and the text-based demo logo lockup require design approval; these are not final brand templates.

## Isolation and limitations

- Drafts live in browser sessionStorage with an in-memory fallback, not the database. They survive reload in the same tab. There is no production persistence, upload, publish API, or export.
- A file picker reads JPG/PNG/WebP locally (4 MB cap). Multiple images can exceed sessionStorage capacity; the interface reports its in-memory fallback.
- Existing stories, CRM data, and the locked website are untouched.
- Social preview does not scrape, extract thumbnails, fetch platform metadata, or generate official embeds. Direct post URLs are canonicalized using the existing validator. Short links are not resolved.
- Uploaded artwork is not automatically converted into a print-ready asset. Letter preview is only a composition preview, not a 300 DPI export.
- Publication timestamps are assigned only by the simulated publish action. CTA validation requires full HTTPS destinations.
- Navigation to Workspace does not save unsaved changes. Use Save draft first.

## Validation

Scoped ESLint, TypeScript, production build, and six synthetic rule checks passed. Desktop (1440px) and mobile (390px) browser checks exercised event creation, Letter preview, simulated publishing, same-tab persistence, article image selection, article publishing, and horizontal-overflow/runtime-error assertions. Browser interaction checks used a temporary loopback-only Vite harness, without changing the real access gate. The real Next route redirected an unauthenticated request to login. Authenticated production-route access still needs review with an actual Owner/Admin session.

Next: review the start screen, step sequence, preview placement, and template composition visually. Only after approval move this into Pulse navigation and connect persistence, authorized uploads, exports, and website publishing.
## Event flow refinement

Event editing now uses Event Details → Design → Publish, with numbered progress and one shared sticky footer. Back and Next occupy consistent positions; the final step replaces Next with Publish to Website and offers Print. Save draft is in the same footer. Back on the first step returns to the workspace without saving. Back to Pulse links and Continue labels are removed. Details and artwork checks block incomplete progression. Publishing remains simulated.

Five reference-inspired poster treatments combine condensed Oswald typography, vivid opaque palettes, editable text, academy-local date/time, the real Headliner logo, and optional grayscale supporting photos: stage showcase, instrument-led camp, portrait/open mic, community ensemble, and songwriting workshop. Fallback graphics use existing Lucide icons; they are illustrative, not final commissioned artwork or realistic silhouettes. Theme and layout can be overridden separately. Keyword suggestions inspect title and supporting text; no AI or remote image search runs. Other content workflows retain their original structure, with Next labels.

## Proposed production asset and theme workflow (not implemented)

### Simplified design refinement

The Event editor now has one visual Design picker; it sets palette and layout together. The old theme/layout selectors and duplicate palette buttons are removed, as are the unsolicited keyword/image helper paragraphs. Logo pixels are rendered white on dark template logo zones and black on light ones. Event time starts blank and offers 48 half-hour choices, never the current clock time. Event CTA is text inside the generated poster, with no destination URL or URL validation; other content flows retain their link rules.

Style references accepts up to five JPG/PNG/WebP files (4 MB each), separate from the supporting poster image. References are stored with the session draft and can be removed; they do not train a model, trigger AI, or change the design automatically. Browser storage limits still apply.

Location accepts manual text. Google Places search is enabled when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set at build time. Configure a browser key restricted to approved application origins and the required Maps JavaScript/Places APIs; enable billing and Places API (New), then rebuild. It uses Google's PlaceAutocompleteElement and fetches only displayName/formattedAddress on selection. No key is configured locally, so live Places requests are unverified. Search failure preserves manual entry. No new package was installed.

This refinement passed scoped lint, TypeScript, production build, ten synthetic tests and desktop/mobile loopback-browser checks for half-hour times, one design picker, logo variants, text-only CTA, separate reference upload/removal/persistence, simulated publication and no overflow/runtime errors.

- Keep layout, typography, palette, logo placement, crop zones, and text-fitting rules in approved templates. Generate the text as real text, not inside an AI image.
- Build an academy-scoped asset library: approved academy photography first, commissioned transparent illustrations/cutouts second, licensed stock only when reviewed. Store subject/instrument/theme tags, crop/focal points, source, credit, license usage, and permission/guardian approval metadata. Do not infer consent from image content.
- Use the event category and staff-selected theme first. Optional AI can return a constrained theme ID, subject tags, recommended approved asset IDs, and a short rationale from the title/description. Validate IDs and require staff approval; keep the keyword fallback and explicit overrides.
- AI-generated non-person illustrations could be an optional reviewed source. Do not fabricate students or claim generated imagery documents an actual academy event. Never scrape arbitrary web images automatically.
- Production still needs permission enforcement, persistence, uploads, text-fitting limits, tested print/export rendering, and actual website publishing.

Validation of this refinement: eight synthetic tests, scoped lint, TypeScript and production build; a loopback browser harness exercised all five themes, event wizard back/next, blocked empty details/artwork, uploaded artwork, simulated publication and same-tab persistence at 1440px/390px with dark system preference, without horizontal overflow or runtime errors. The real route remains protected; authenticated production-route interaction still needs an Owner/Admin session.
