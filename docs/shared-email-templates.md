# Headliner shared email templates

The live inbox loads templates from `/api/conversations/templates`, authorized with
`communications.read`. All communications readers in the Headliner workspace can
use the same four approved templates; settings-management access is not required.
Other tenants receive no Headliner-branded templates. The library is currently
version-controlled in `lib/headliner-email-templates.ts`, not browser storage and
not a Google Docs synchronization. Editing the library still requires a code change.

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