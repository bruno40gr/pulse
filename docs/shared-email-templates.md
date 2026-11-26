# Headliner shared email templates

The inbox, contact/profile, bulk and group email composers load the same library
from `/api/conversations/templates`, authorized with `communications.read`.
School Setup → Email templates uses the same editor as the composer modal.
Readers can select templates; owners and staff with `communications.send` can
create, edit and remove them. Settings-management access is not required.

Changes are tenant-scoped in `shared_email_templates`, not browser storage or
Google Docs. Approved Headliner copy remains the initial library for Headliner
only. Saved overrides replace a default by its stable ID. Removal archives that
ID, so a removed default does not reappear on reload. Existing emails and drafts
are untouched. Version checks reject stale edits instead of overwriting them.
Templates contain plain text; insertion retains the existing escaping, signature
and unresolved-placeholder checks. School Setup previews the stored placeholders
without substituting guessed names.

Each opening refreshes the shared list; successful saves refresh the current
editor. Already-open editors retain their selection/draft and reject conflicting
saves. Close and reopen to see changes made elsewhere. Sample composers remain
local and do not write to the shared library. The School Setup email-template
section is live, separate from the scheduling sample sections.

## Installation status

`supabase/migrations/202611260001_shared_email_templates.sql` is prepared locally,
**applied to Odeon production on November 26, 2026**, through the approved migration workflow. The local rehearsal and production read-only privilege checks passed. No existing rows were changed. Without storage, approved defaults remain readable and editing is
disabled; writes return an error. Other storage failures fail closed rather than
resurrecting removed defaults. The table is RLS-enabled, direct browser roles have
no access, and service-role access excludes destructive delete/truncate.

## Local checks — November 26, 2026

- All 1,291 security tests passed, including eight new shared-library tests.
- TypeScript, targeted ESLint and whitespace checks passed.
- Intercepted browser checks passed at 1440, 900 and 390 pixels: create/edit/remove,
  retained text after failed saves, sharing with an already-mounted composer,
  reload persistence, reader-only controls and no horizontal modal overflow.
- Browser checks use fictional responses and the actual shared UI components in
  an isolated loopback page. They do not verify deployed routing, real database
  persistence, migration execution or provider delivery.

## Imported copy

- 2-Day Contact
- 5-Day Contact
- One Week Contact
- META Lead / Generic Email

Body wording, telephone numbers, hours, email addresses and closings are retained
from the supplied document. Subject lines were added because the source omitted
them. Admin name/title placeholders are omitted from bodies because the automatic
signature supplies these once. Signature title is an optional shared workspace
field; individual per-user titles are not implemented. A blank signature name uses
the signed-in sender's name.

Member and child placeholders resolve only from known contact/student names.
Missing names remain bracketed. Instrument and son/daughter placeholders always
require manual review; gender and program details are never inferred. Both the
composer and send API reject unresolved bracketed or double-brace placeholders.
The generic template has no student or particular-program placeholders. Review
the voicemail/phone assertions before sending; using a template never sends it.

## Signature migration

Migration 025 (`scripts/migration-025-email-signature.sql`) was applied to the
local app's configured **Odeon-staging** project on October 19, 2026, tracked as
`20261019204126 / 025_email_signature`. The `tenant_settings.email_signature`
column was verified as non-null JSONB with an empty-object default.
Production was not changed. No existing signature settings were populated or
overwritten by the migration.

Configure the public company name, optional shared name/title, public phone and
separate black/dark HTTPS logo under **Settings → Brand → Email signature**.
An internal staging tenant name and general white app logo are never defaults.