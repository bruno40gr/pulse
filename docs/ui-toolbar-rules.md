# Table toolbars

## Page header (zone 1)

- The header carries the title and the primary page action, never the record count.
  Contacts keeps Sync, Import Contacts and Add contact as secondary operational
  actions; import and sync are transitional.
- Contacts renders Enroll new student as the primary action linking to
  `/content-studio-prototype/enrollment`. Use an anchor styled from the exported
  Button style objects so navigation keeps middle-click and open-in-new-tab; do not
  nest a button inside a link. That destination performs its own owner/admin check,
  so the header must not duplicate the enrollment access rule.

## Contextual selection mode

- `RichDataTable.contextualToolbar` is the opt-in selection mode. Supply it only
  when the domain has selected records. `TableToolbarMode` overlays both modes in
  one grid cell; inactive discovery controls remain mounted, hidden and inert.
  This preserves input/preferences state and responsive height without showing
  two bars. Existing consumers need not adopt selection mode immediately.
- Use `TableContextActionBar` for selected count, domain-defined actions and a
  labeled X to clear. The bar is solid `colors.link`, the same blue as Active
  badges, links and notices, with white text; action buttons are transparent ghost
  buttons with no border. Do not introduce a second blue or a teal fill. The domain supplies handlers, labels
  and eligibility reasons. Contacts labels Edit for one person and Bulk Edit for
  multiple people.
- Keep the matching-result count in `beforeTable`, separately from selected count.
  Never show disabled messaging actions in discovery mode. Contacts keeps its
  existing View as toggle. Its AI search field grows to about 820px on desktop so
  it remains the primary control, and Filters sits directly beside it.
- Clear selection must not clear query, applied filters, sorting, view or table
  preferences. Contacts selections persist across pagination; select-all toggles
  eligible visible people without replacing selections on other pages.
- Contacts sends selected IDs directly to ContactBulkComposer for either channel
  and any selection size. Its server-backed resolution owns eligibility,
  account-holder routing, deduplication and exclusions. Communications retains its
  independent compose/recipient-picker entry points.
- Multi-condition filters open in a narrow `SlidePanel`, not an inline row. Stack
  shared `Select` fields with `FieldGrid columns={1}` and apply the draft only on
  Submit search, so choosing options never re-queries. Clear filters resets the
  draft; closing without submitting discards it. Contacts keeps Status plus every
  configured tenant field that has options.
- Do not change row rendering, group relationships, density or selected-row colors
  to implement toolbar modes. No mock records or review UI belong on Contacts.

- Leads and Contacts instantiate `components/ui/RichDataTable.tsx`. It owns the toolbar layout, metadata-column picker, density, visible-column sizing and detail-cell projection. Domain adapters supply rows, columns, toolbar actions and a stable preference schema; do not clone the table or its controls per page.
- Use `TablePersonName` for parent/detail table names. Details retain normal weight even when a domain supplies a profile-opening action; Leads details can remain display-only. All name actions use the shared name control. Contacts family groups stay fully expanded without indentation. No family chevrons or “Via” labels.

- Contacts selection is **message-target selection**, not record selection. A person is selectable only when delivery would reach them: `isMessageTarget` delegates to `routesToAccountHolder` in `lib/communication-recipients.ts`, the same rule the server resolver uses. Never restate that rule in the client; a test fails if `lib/contact-list-views.ts` does. The server stays authoritative for destinations, opt-outs and exclusions.
- **A payer is always selectable, even when their own row carries `message_routing: 'account_holder'`** — that value describes what they are, and routing it to the account resolves to themselves. Imported payer rows commonly carry it, so excluding them made the holder unselectable and left children as the only tappable rows. This was the production regression on 2026-11-02; a regression test covers it.
- Children never get a checkbox: this restores the parent-only selection that existed before the shared person-table rollout (`694579c`) introduced per-person child checkboxes.
- Minors and account-holder-routed students get **no checkbox**; their account holders carry the selection. A search that matches only minors surfaces that family's account holders as the selectable rows. A row shows a checkbox when it is selectable now (enabled) or is a message target outside the current context (disabled); rows that can never be in the selection set show none.
- **Fallback:** if a family's account-holder row cannot be resolved from the payload, keep the matched rows selectable — delivery still routes their message to the account, and losing every checkbox in the family is worse. `/api/contacts` only sets `account_holder_person_id` when exactly one holder is known, so it now prefers the `account_holders` rows and keeps a `person_id` on each. If a tenant still shows children selectable, check that the `account_holders` table has rows for those accounts.
- The family-wide double-click shortcut is retired.
- **Bulk edit of students is deliberately unavailable.** Children are not selectable, so students cannot be bulk-edited today. To add it later, add a filter-scoped **"apply to all N matching"** action operating on *records* (distinct from the recipient-based actions) instead of restoring child checkboxes: every real bulk case is "all students matching X", never a hand-ticked set across families. Bulk instructor reassignment is explicitly not wanted — handle it case by case.
- Contacts and Leads use shared `TablePersonViewToggle`, built on the Notes `ToggleSwitch` between “View as: Students / Families” for Contacts and “View as: Account holders / Families” for Leads, immediately before Columns & spacing. Use role="switch" and aria-checked; keep all contact roles visible in either Contacts presentation. Leads Account holders shows only inquiry contacts; Families expands student detail rows beneath them. The viewing counter sits below the toolbar and above the table. Pagination keeps family groups intact. Keep this group at the right edge, wrapping on mobile.
- `TableDisplayControls` is the shared picker (also used in the design-system showcase), not a Leads-specific control. Storage is tenant/membership/table scoped; Leads keeps its released storage key.

- Use shared `Button variant="secondary" size="toolbar"` for peer toolbar actions, including column-picker triggers. Do not hand-style a native summary to resemble a button.
- Use shared `Select controlSize="toolbar"` for compact toolbar filters. This uses the same sizing, border, typography and radius as toolbar buttons. Do not override it with legacy input styles.
- Align controls centrally with `spacing.sm` gaps and allow wrapping on narrow screens. Keep the display-options trigger at the right edge.
- Toggle state uses `aria-pressed` and a check indicator; disclosure state uses `aria-expanded` and `aria-controls`. Escape closes the picker and restores trigger focus; outside clicks and tabbing out dismiss it.
- The columns picker contains only the column choices and row-spacing control. Do not add saved-preference helper copy or a reset action.
- Preferences remain browser-local and membership-scoped. Toolbar interactions must not add polling or per-column requests.
- The live component example is the **Table toolbar** section in `/dashboard/design`.
- Shared `TablePagination` paginates Contacts and loaded Leads, keeping family/inquiry groups intact. Leads retains its explicit server-backed Load more action and identifies counts as loaded inquiries. Leads selects only inquiry/contact records; student rows have no checkbox, never inherit parent selection/highlighting, and never become action targets. View changes clear selection without refetching or altering actions/permissions.
