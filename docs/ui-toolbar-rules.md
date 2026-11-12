# Table toolbars

## Page header (zone 1)

- The header carries the title and the primary page action, never the record count.
  Contacts keeps Sync and Import Contacts as secondary operational actions;
  import and sync are transitional. Align these and enrollment in the header’s
  top-right actions slot next to the title; wrap on narrow screens. There is no
  separate Add contact action: enrollment is the creation entry point.
- Contacts renders Enroll new student as the primary action linking to
  `/content-studio-prototype/enrollment`. Use an anchor styled from the exported
  Button style objects so navigation keeps middle-click and open-in-new-tab; do not
  nest a button inside a link. That destination performs its own owner/admin check,
  so the header must not duplicate the enrollment access rule.

## Contextual selection mode

- `RichDataTable.contextualToolbar` supplies the domain action bar. Contacts uses
  `contextualToolbarPlacement="below"`: discovery controls remain visible and usable,
  with `TableResultsSlot` below them: the count and blue bar share one grid cell,
  so selecting/clearing never inserts height or moves the table. Reserve 42px on
  desktop and 76px below 640px for a compact two-line action layout. Keep the
  discovery-to-results gap at `spacing.sm` (8px). Other consumers retain the
  opt-in replacement mode by default. Both placements use `TableToolbarMode`.
- Use `TableContextActionBar` for selected count, domain-defined actions and a
  labeled X to clear. The bar is solid `colors.link`, the same blue as Active
  badges, links and notices, with white text; action buttons are transparent ghost
  buttons with no border. Do not introduce a second blue or a teal fill. The domain supplies handlers, labels
  and eligibility reasons. Contacts exposes Text, Email and Clear only; editing stays in individual profiles.
- Supply the matching-result count through `TableResultCount` in `beforeTable`.
  During selection the bar replaces it with “3 out of 167 contacts selected”;
  pass the matching-result label to `TableContextActionBar.resultLabel`. Both
  states use the same base font size and medium weight. The hidden normal count
  is inert and aria-hidden. Do not render two announced counts at once.
  Never show disabled messaging actions in discovery mode. Contacts uses the shared toolbar-sized segmented view control (View students / View families). Its AI search field grows to about 820px on desktop so
  it remains the primary control, and Filters sits directly beside it.
- Clear selection must not clear query, applied filters, sorting, view or table
  preferences. Contacts selections persist across pagination; select-all toggles
  eligible visible people without replacing selections on other pages.
- Contacts sends selected IDs directly to ContactBulkComposer for either channel
  and any selection size. Its server-backed resolution owns eligibility,
  account-holder routing, deduplication and exclusions. Communications retains its
  independent compose/recipient-picker entry points.

## Shared row scanning

- `ResponsiveDataTable` applies the `colors.tableRowHover` inset overlay to every
  data row, including family detail rows. The translucent blue works over white,
  alternating light gray and selected backgrounds without changing their base
  colors. It is presentation only; hovering never selects or opens a record.
- Instructor names use `PersonName roleVariant="instructor"` (regular weight),
  rather than inheriting the primary person's bold weight.
- `/dashboard/design/contacts-table` uses the same `TableResultsSlot`,
  `TableResultCount` and action bar to demonstrate stable selection geometry.
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
- Leads also defaults to 50 with the shared 25/50/100/250 options. Size changes
  reset to page 1 without clearing selection. Labels follow its Families / Account
  holders view; pagination counts loaded inquiries and keeps their student detail
  rows together. The explicit server-backed Load more leads action remains.
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

## Persistent table preferences

- Use `useTablePreferences` at the stable page/workspace level when loading or
  toggles unmount the table. Pass its `preferenceState` to `RichDataTable` (or
  `FamilyListTable`); do not restart preference hydration on each table mount.
- Preferences stay tenant/membership/table scoped in localStorage. Changes made
  before account verification completes are retained and saved once verified,
  rather than overwritten by older storage or silently left unsaved.
- Leads owns its preference hook above the table and persists sort key/direction
  and page size alongside visible columns and spacing. Restore validated values
  from the existing key; legacy entries retain default Created descending / 50.
  Preferences survive visits in the same browser, not across devices. Do not
  persist selections or inline edit drafts. Schemas without sorting/page-size
  metadata retain their previous preference shape.

## Leads follow-up cells

- Separate Follow-up date and Follow-up reminder columns display the current
  deadline and latest follow-up reminder, not the general Notes history. Clamp the reminder preview to two lines; the
  edit control exposes the complete reminder. Empty values remain visually blank, with an accessible edit target; never
  render Add date / Add reminder placeholders. Preserve deadline urgency colors and existing sorting rules.
- Follow Cloudscape's direct-cell-edit pattern with existing shared controls:
  edit one field in place, confirm/cancel with labeled check/X controls, visible
  focus and a pencil on hover/focus (always on touch). No modal or popup form.
  Keep shortcut/helper copy out of cells. Date Enter and reminder Ctrl/Command+Enter
  save; Escape cancels. Blur never
  saves or discards a draft. Errors remain inline with the draft intact.
- Save through the existing lead PATCH endpoint and activity trail. Table and
  LeadDetailPanel share returned data in both directions; clear removes payload
  fallback values too. A table save clears stale panel follow-up drafts without
  discarding unrelated note drafts. Re-sort only after successful save, with no
  separate reapply-sort prompt. General notes and lead status are not edited here.

- Leads row-body clicks toggle the parent inquiry checkbox, including family detail
  rows. Only the primary name control opens the lead panel. Inline edit controls,
  save/cancel actions and checkboxes do not bubble into row selection.
- Existing visible follow-up preferences migrate once to include the reminder
  column; later staff choices to hide either column remain respected.
- Leads uses the shared blue `TableContextActionBar` in replacement mode: it
  replaces Export/Status/View/Columns controls without moving the table. Search
  remains visible. Actions are Update follow-up, Text, Email, and owner-only
  Delete (enforced by the API too). Clear selection restores unchanged controls.
- Update follow up opens a shared SlidePanel with the selected lead count,
  Date, Quick pick (Tomorrow/Next week/Next month) and Reminder note. The footer
  is Update follow then Cancel. Common values are prefilled; differing values
  show Mixed (a hint for the native date picker). Only edited fields overwrite
  values for all selected leads. Clearing an edited field clears that value;
  mixed fields have a clear action since their input starts empty. No mode
  selectors. Save snapshots the targets, preserves unrelated payload fields,
  shows partial failures, and retries only failures with the original patch.
  Applications do not support follow-up editing. Text/Email reuse the Contacts
  composer and its server-backed eligibility, exclusions and deduplication.
