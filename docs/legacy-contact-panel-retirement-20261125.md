# Legacy contact panel retirement — November 25, 2026

## Completed locally

- Overview now uses `ConversationProfilePanel`, the existing permission-aware
  host for `LiveContactPanel`. Contact edits update Overview's detail and preview
  caches without resetting the active profile or its family navigation.
- Staff now uses the same host. The legacy tenant-field fetch and pre-panel
  detail fetch are gone; the host owns loading, errors, and mobile history.
- The shared contact type includes instructor active-student summaries. The
  shared panel retains instructor status, sunset/offboard confirmation,
  reactivation, and active-student navigation. Mutations remain permission-gated
  and tenant-scoped through the existing contact endpoint.
- Student navigation loads the explicit person ID, preserves roster family
  metadata, rejects a returned foreign tenant, and ignores superseded responses.
- Instructor status/detail fields survive merging with the contact roster.
- Staff contact edits update table values; sunset removes the row and
  reactivation restores it. Bulk selection/messaging keeps its existing composer.
- Original-recipient SMS/email actions hand off to Communications. A different
  family/student profile uses its own composer, never the original recipient's.
- Only the shared host registers mobile panel history for these callers.
- Funding now uses the same live host, opens the selected case on Funding
  Program, and shows that case's invoices under Billing. Detail and invoice
  updates refresh both the open panel and table; malformed invoice responses
  are rejected. Navigating to another person cannot reuse the original case or
  invoice callback.
- Fictional funding cases use the same panel in a restricted funding-only mode:
  no contact editor, messaging, notes, follow-ups, or live contact roster reads.
  Demo invoice/detail updates remain browser-session-only. The funding table is
  skeleton-first while its initial request is pending.

## Production component retired locally

- Contacts now uses `LiveContactPanel` for all tenants and person/account roles,
  preserving notes deep links, permission headers, table updates, family links,
  instructor navigation, bulk composition and its single mobile-history owner.
- Linked person navigation verifies the requested ID and tenant and ignores
  superseded results. Instructor links on subscription cards remain actionable.
- Fictional Contacts use explicit simulated mode: local edits/notes, simulated
  SMS, disabled live call/email, no operational follow-up/family/funding reads or
  writes, and no mention-directory requests. The prototype SMS composer has an
  explicit local setup transport as well as a local send callback.
- The Beta event explorer was an additional production-component caller missed
  by the earlier scan. It now uses the shared panel, starts on Enrollments, keeps
  its existing enrollment renderer and retains profile changes locally.
- Dependent source contracts now assert the shared behavior. The production
  `components/contacts/ContactSlidePanel.tsx` is deleted; no imports of that
  module remain.
- Escape first exits the embedded composer, then dismisses the profile.

### Separate Beta legacy implementation remains

`beta-source/components/contacts/ContactSlidePanel.tsx` is a distinct module,
still referenced by Beta StaffView and Beta ConversationProfilePanel. Those
preview adapters are not migrated here. Production-module retirement is complete,
but repository-wide removal of every component bearing that name is not.

This work does not change API permissions or claim to revoke authentication on
sunset; the existing server status behavior and confirmation are retained.

## Validation

- 174 focused contact, family, profile, funding, lesson-summary and composer
  tests pass (`/tmp/contact-retirement-regression.log`).
- Full security suite: 1,188 tests, 1,170 passed, 18 failed. All remaining
  failures reproduce on unchanged HEAD `8f5d2a5` in an isolated archive:
  16 Gmail dependency-mock failures plus interaction-colors/loading-surfaces
  source contracts. Logs: `/tmp/contact-retirement-all-tests-final.log` and
  `/tmp/contact-retirement-baseline.log`. The newly conflicting lesson-summary
  contract was updated to allow only the preserved instructor confirmation.
- TypeScript and diff whitespace checks pass.
- Targeted ESLint has no errors; existing unused-variable warnings remain in
  Overview and Contacts.
- Loopback-only browser checks cover desktop/mobile staff student navigation,
  history dismissal, contact editing, notes persistence, cancellation, rejected
  status writes, sunset/reactivation, read-only controls, SMS handoff, and bulk
  composer opening. Writes are intercepted synthetic fixtures, not live sends.
- Existing Communications and family desktop/mobile browser checks pass.
- New Contacts checks pass at 1440px and 390px for both a non-default tenant
  non-student contact and fictional Contacts. Coverage includes initial internal
  notes, local/live fixture edits and notes, permissions, enrollment integration,
  SMS/back, Escape, mobile Back, note retention and zero fictional API requests
  (`/tmp/contacts-shared-profile-browser.log`).
- Funding (four scenarios), Staff and Communications (two each), and family
  navigation (four widths) browser regressions pass. The family fixture now
  serves explicit person-detail requests instead of returning an invalid array.
- An older `live-contact-profile-browser.cjs` attempt timed out during page load;
  it is not counted as passing. The new focused Contacts coverage above passed.

Production was previously verified READY on `8f5d2a5`. These caller migrations
are local work until separately committed and deployed.