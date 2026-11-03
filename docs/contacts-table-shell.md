# Contacts table shell

Review route: `/dashboard/design/contacts-table`. This is an isolated sample-data
prototype, not a production Contacts migration. Live Contacts and Leads are
unchanged. The prototype makes no database writes, delivery calls or AI requests.
Enrollment, editing, import, sync and composing are labeled preview surfaces.

## Components under review

- Reuse PageHeader, Input, Select, Button, TablePersonViewToggle, SlidePanel,
  SlidePanelHeader, FieldGrid, ResponsiveDataTable, TablePersonName,
  TableDisplayControls, TablePagination and existing tokens.
- Improve TableDisplayControls with an optional label. Existing consumers retain
  “Columns & spacing”; the shell demonstrates “Table Preferences”.
- New TableDiscoveryToolbar supplies composable search, filters, view, preferences
  and chip slots. It does not own search or domain logic.
- New TableContextActionBar accepts result text, selection count, off-page
  disclosure and declarative actions with eligibility reasons and callbacks.
  It contains no contact/messaging business rules. Actions stay visible when
  disabled. Focusable wrappers and descriptions expose disabled explanations to
  keyboard/screen-reader users; native titles provide hover explanations.

## Working behavior

- A 380px filter drawer stacks six Select controls. Draft changes, including Clear
  filters, never apply until Submit search. Closing without submitting discards
  the draft on reopening. Conditions combine with AND; chips remove one condition.
- Local name search runs on Search/Enter. Production natural-language search and
  AI-versus-standard filter interaction are not changed by this prototype.
- Counts represent matching people, not family rows. Sample families group three
  people. Context-only relatives appear but cannot be selected.
- Selection survives filtering, sorting, pagination and view switching. Select-all
  changes eligible visible records only. Clear selection clears all records.
  Hidden/off-page selection is disclosed. Names open previews; row clicks do not
  select or navigate. Sample grouping is not a replacement for contactViewGroups.
- Messaging previews prepopulate selected sample destinations and deduplicate
  shared addresses/numbers. Sample destinations model account-holder routing;
  production routing is neither changed nor reimplemented. No recipient repicking.

## Deferred until approval

Production enrollment/edit/import/sync adapters and ContactBulkComposer connection;
server-authoritative recipient eligibility; shared selection-controller extraction;
action overflow/confirmations when required; visible focus explanations; compact
segmented sizing and arrow-key refinements. No placeholder production actions are
introduced. The shell identifies these boundaries directly in the UI.

## Validation

Run `scripts/security/contacts-shell-browser.cjs` with PLAYWRIGHT_MODULE and optional
CONTACTS_SHELL_URL. It checks deferred/aggregate filters, chips, selection,
pagination, messaging previews, family view, preferences, responsive overflow and
absence of domain writes at 1440, 900 and 390px. Local screenshots are written to
`/private/tmp/pulse-contacts-shell-*`.
## Review refinements

Keep the existing View as: Students / Families toggle and table row renderer.
Search has a wider, higher-contrast surface. The primary action is Enroll new
student. Edit keeps the same label for single and multiple selection. Clear
selection is an accessible X shown only when selected, with space reserved to
prevent action buttons shifting. Filter drawer instruction copy is removed.
