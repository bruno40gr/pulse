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

- `RichDataTable.contextualToolbar` supplies the domain action bar. Contacts uses
  `contextualToolbarPlacement="below"`: discovery controls remain visible and usable,
  with the blue bar below them only while selected. Other consumers retain the
  opt-in replacement mode by default. Both placements use `TableToolbarMode`.
- Use `TableContextActionBar` for selected count, domain-defined actions and a
  labeled X to clear. The bar is solid `colors.link`, the same blue as Active
  badges, links and notices, with white text; action buttons are transparent ghost
  buttons with no border. Do not introduce a second blue or a teal fill. The domain supplies handlers, labels
  and eligibility reasons. Contacts exposes Text, Email and Clear only; editing stays in individual profiles.
- Keep the matching-result count in `beforeTable`, separately from selected count.
  Never show disabled messaging actions in discovery mode. Contacts uses the shared toolbar-sized segmented view control (View students / View families). Its AI search field grows to about 820px on desktop so
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
  draft; closing without submitting discards it. Use compact shared Select controls.
  One flat field list: Name, Status, Email, Last active, Instructor, Program,
  Service / class and Funding. No Basic/Advanced sections. Do not automatically
  render every tenant field: that duplicates Instructor and other concepts.
  Service / class matches service_type, session_name or appointment_class_name;
  Program matches program or instrument. Values remain unchanged in stored data.
  Exclude Band/Plan and email/phone availability (those can use AI search).
  Last active is explicitly last attendance, not login activity.
  The bottom checkbox, Show only active students & families, defaults checked.
  Active classification comes from the tenant import profile via API status_class;
  the compatibility fallback includes Active and Member, case-insensitively.
  Never restrict active students to the literal string active. Unchecking and
  submitting restores other statuses, including Lost, subject to other filters.
  Show the number of applied conditions (including active-only) as a bubble on
  the Filters icon. Draft changes do not change the count; no bubble when zero.
  AI results retain existing precedence, so bypassed standard filters are not counted.
  Conditions aggregate on Submit search; no requests occur while editing.
  Clear filters removes the default too. AI-search precedence is unchanged for now.
- Do not change row rendering, group relationships, density or selected-row colors
  to implement toolbar modes. No mock records or review UI belong on Contacts.

- Leads and Contacts instantiate `components/ui/RichDataTable.tsx`. It owns the toolbar layout, metadata-column picker, density, visible-column sizing and detail-cell projection. Domain adapters supply rows, columns, toolbar actions and a stable preference schema; do not clone the table or its controls per page.
- Use `TablePersonName` for parent/detail table names. Details retain normal weight even when a domain supplies a profile-opening action; Leads details can remain display-only. All name actions use the shared name control. Contacts family groups stay fully expanded without indentation. No family chevrons or “Via” labels.

- Contacts Families view exposes checkboxes on account-holder headers and explicitly
  identified additional account holders only. Child detail rows have no checkbox,
  regardless of age or messaging-routing flags. Standalone contacts remain selectable.
- Account-summary headers remain selectable without a linked holder person. Their
  matching record IDs are transport inputs to the existing composer/resolver, not
  evidence that the child rows are selected as individual recipients.
- Checkbox presentation is independent of delivery eligibility. The server resolver
  owns routing, destination validation and deduplication. Do not import delivery
  predicates into table grouping or checkbox presentation.
- Child selection can be enabled later at the existing detail-row `selection`
  mapping in `FamilyListTable`; the shared grid already supports those checkboxes.
  No schema migration or new table selection framework is required. Any future bulk
  edit policy is separate; instructor reassignment remains case by case.
- Contacts and Leads share `TablePersonViewToggle`. Contacts opts into toolbar-sized
  segmented View students / View families buttons (`aria-pressed`); Leads retains
  its Account holders / Families switch. Keep controls before Table Preferences,
  wrapping on mobile. View changes do not change data roles or family relationships.

- `TableDisplayControls` is the shared picker (also used in the design-system showcase), not a Leads-specific control. Storage is tenant/membership/table scoped; Leads keeps its released storage key.

- Use shared `Button variant="secondary" size="toolbar"` for peer toolbar actions, including column-picker triggers. Do not hand-style a native summary to resemble a button.
- Use shared `Select controlSize="toolbar"` for compact toolbar filters. This uses the same sizing, border, typography and radius as toolbar buttons. Do not override it with legacy input styles.
- Align controls centrally with `spacing.sm` gaps and allow wrapping on narrow screens. Keep the display-options trigger at the right edge.
- Toggle state uses `aria-pressed` and a check indicator; disclosure state uses `aria-expanded` and `aria-controls`. Escape closes the picker and restores trigger focus; outside clicks and tabbing out dismiss it.
- The columns picker contains only the column choices and row-spacing control. Do not add saved-preference helper copy or a reset action.
- Preferences remain browser-local and membership-scoped. Toolbar interactions must not add polling or per-column requests.
- The live component example is the **Table toolbar** section in `/dashboard/design`.
- Shared `TablePagination` paginates Contacts and loaded Leads, keeping family/inquiry groups intact. Leads retains its explicit server-backed Load more action and identifies counts as loaded inquiries. Leads selects only inquiry/contact records; student rows have no checkbox, never inherit parent selection/highlighting, and never become action targets. View changes clear selection without refetching or altering actions/permissions.
### Account-holder evidence and environment limits

Contacts already distinguishes the named account summary (`accounts.name/phone/email`)
from an optional explicitly linked holder person (`account_holders.person_id`). Both
are valid header representations. An empty optional relation does not remove the
account-holder distinction or require a migration to render a named header.

The diagnostic reads `.env.local` and a configured/fallback tenant. Its results must
not be described as production evidence without independently verifying that target.
Earlier claims in this document that the local counts proved production had no
account holders were incorrect and are withdrawn.

## Page size and view controls

- `TablePagination` accepts optional controlled page size/options and an item label;
  consumers without them retain their existing pagination. Contacts defaults to 50,
  offers 25/50/100/250, and resets to page 1 when size changes without clearing selection.
- Family pages count whole groups, never split families. Label the size as families
  per page in Families view and contacts per page in Students view.
- `TablePersonViewToggle variant="segmented"` reuses `Tabs` prominent presentation
  with toolbar sizing and pressed buttons. Contacts uses View students / View families.
  Leads retains its existing switch; this is an opt-in shared capability.

- Contacts maps selection on view changes using explicit tenant/account groups:
  Families → Students selects every recorded student of selected families;
  Students → Families selects the account-holder controls of represented families.
  Three families with two students each become six students selected, then three
  families selected on return. Standalone contacts remain selected. Mapping uses
  all loaded contacts, not only the current page/search matches. No name matching.
  Accounts without recorded students retain their selectable contact records;
  partial student selections represent their whole family on conversion.
- Family selection counts groups once, even when account-summary transport uses
  several child IDs. Student counts count records. Neither is a delivery count;
  the existing composer resolves/deduplicates account-holder destinations.
