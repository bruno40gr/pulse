# Contacts family integration — release review

## Release boundary — October 31, 2026

Main retains the shared Contacts/Leads tables, explicit family grouping, profile
presentation and existing production messaging paths. Family-management editing
is deferred to the existing Odeon workspace/enrollment line; it is not part of
Edit contact in this release.

The removed local-only editor is preserved as a complete patch and integration
notes under `/Users/brunowong/pulse-odeon-integration/docs/deferred-contact-family-editor/`.
It was not applied over Odeon's dirty source files. Its exact tree was recovered
from the recorded base using an isolated Git index before removal from main.
Backup: `/Users/brunowong/pulse-backups/contacts-release-split-20261031-213536/`.

The multi-account-manager SMS picker remains fictional-lab-only. Production uses
the existing recipient resolver; no new live-send authorization is enabled here.
The documented wrong-recipient and ambiguous account destinations are unresolved
release gates for new family recipient routing. UI tests are not evidence of
production recipient correctness. No production migration or real send was run.

## October 31 prototype messaging iteration — current handoff

Supersedes the status and validation sections below. This is fictional shell-data
prototyping, not production account management or delivery verification.

- Review: `http://127.0.0.1:3218/dashboard/contacts`. The isolated lab explicitly
  enables `ContactPrototypeContext`; normal application pages default to false.
- Both child and verified holder names open the current ContactSlidePanel, not a
  summary-only account wrapper. Child names retain normal weight, shared name
  controls and parent-only table selection. No chevrons or “Via” labels.
- ContactSlidePanel now uses the latest original-worktree presentation: shared
  action bar, flat section cards, current header and accessible FieldGrid/forms.
  Original `/Users/brunowong/pulse` in-progress work was read, not overwritten.
- Sophie Kim and minor Ethan Kim open their own profiles; SMS displays Sam Kim
  and `(202) 555-0102`. Adult Ethan uses `(202) 555-0105`; Sam uses his own number.
  The lab's “Ethan Kim review scenario” dropdown switches minor/adult shell data.
- PrototypeContactSms reuses ComposePanel's existing injectable transport. Sends
  are in-memory simulations with explicit confirmation; no campaign/send endpoint
  is invoked. About-person and recipient remain separate. Calls/email are disabled
  in this prototype; the lab API rejects unsupported writes.
- Leads review now uses the same dashboard shell as Contacts, including Settings.
  The actual Settings page is available in the lab. Missing/blank font preferences
  now use 16px rather than being coerced to 14px; blocked storage is handled.
- Fresh validation: TypeScript passed; 48 targeted Node tests passed; targeted
  lint has zero errors and two existing unused-style warnings. Production build
  passed with synthetic primary and CRM Supabase configuration (packaging only).
- Kim messaging, Contacts family-page and Leads browser suites passed at
  1440/900/390px. Checks cover simulated send/back/close, missing-holder disabled
  SMS, minor personal-number protection, shared Settings sizing (18px root gives
  16.875px names on both tables), metadata controls and filtered selection.
- Fresh profile/composer screenshots inspected at desktop/mobile:
  `/tmp/pulse-kim-contact-panel-{1440,900,390}.png` and
  `/tmp/pulse-kim-sms-{1440,900,390}.png`.

Scheduling/billing content retains the latest panel's existing placeholders;
no functioning modules or production relationships are claimed. No messages were
delivered, no commit/deployment performed, and visual approval remains outstanding.

## October 31 shared rich-table correction — current status

This section supersedes the historical implementation and validation claims below.
Those checks predate the current changes and are not current release evidence.

- Leads and Contacts now instantiate `components/ui/RichDataTable.tsx`. Contacts'
  `FamilyListTable` is a domain grouping/selection adapter, not a separate table UI.
- The shared component owns toolbar layout, metadata/column display options,
  comfortable/compact density, visible-column width and detail-cell projection.
  `TablePersonName` owns parent/detail typography and parent name controls.
- The existing Leads picker was moved into shared `TableDisplayControls`; preferences
  use one schema-driven normalizer. Leads retains its released membership-scoped
  storage key/default columns. Contacts uses its own table scope and column schema.
- There are no group expansion controls, child checkboxes or “Via” labels.
  Parent selection applies only to real, currently filtered family records.
- `DataGridTable.tsx` has no diff from the committed baseline.
- Fresh checks: 16 targeted Node tests passed; Leads and Contacts browser checks
  passed at 1440/900/390px with intercepted fictional API responses and no writes.
  Contacts coverage includes column/density persistence, parent-only selection,
  filtered hidden-sibling protection and opening the holder's account panel.
  Screenshots: `/tmp/pulse-contacts-family-page-{1440,900,390}.png` and
  `/tmp/pulse-lead-comfortable-{1440,900,390}.png`.
- AccountFamilyPanel is still a family summary/member-profile handoff, not verified
  full account management. Standalone holder schema mapping, member scheduling/
  billing handoffs and close/back behavior remain release gates. The removed
  role-specific browser runner has not yet been replaced with that full coverage.
- No deployment, commit or visual approval is claimed.
- Final TypeScript and diff checks passed. Targeted ESLint reported zero errors
  and 33 unused-symbol warnings in LeadsView. The fresh production build compiled
  and passed type validation but failed collecting `/api/access/demo` page data
  with `supabaseUrl is required`, despite supplying synthetic build variables.
  A successful full build is not claimed for this revision.

## October 31 recovery: role-aware Leads table alignment

This update supersedes the earlier tree-style appearance and the statement below
that the drawer/shared-table files are unchanged. Not deployed or visually approved.

### Recovered contracts and evidence

- `/Users/brunowong/pulse/odeon.md`, Account Model and permissions: Auth user,
  tenant membership, business person and staff role are distinct. Holder/student
  roles never grant tenant access. Existing server authorization remains in place.
- `/Users/brunowong/pulse/scripts/migration-001-student-accounts.sql`: student/account
  relationships and staff/person roles use explicit foreign keys, not names.
- `/Users/brunowong/pulse/scripts/migration-024-account-people-of-contact.sql`:
  customer account contacts and funding-case contacts are tenant-scoped, separate
  from login memberships and from student status.
- `/Users/brunowong/pulse/docs/odeon-m1-role-identity.md` and
  `/Users/brunowong/pulse/docs/odeon-m1-staging-schema-findings.md`: one person can
  teach and learn; instructor/staff/student IDs are not interchangeable. Staging
  evidence is not production evidence, and proposed constraints are not installed facts.
- `/Users/brunowong/pulse-odeon-integration/app/content-studio-prototype/students/StudentWorkspace.tsx`:
  combined holder/student rows use explicit IDs. Preview identity is not a production
  mapping. No fictional messaging-grant model is substituted for released routing.
- Released `components/leads/LeadsView.tsx` and `components/ui/DataGridTable.tsx`:
  the visual baseline is grouped rows, 44px comfortable row minimum, shared group
  padding, aligned names, semibold parent/normal student, and alternating group backgrounds.

### Implementation

- Contacts now uses the same `ResponsiveDataTable.getDetailRows` grouped rendering
  as Leads. Optional detail selection/click callbacks support real Contacts rows;
  omitted callbacks leave Leads display-only children unchanged. No copied row CSS.
- Removed avatars, tree indentation, arrow markers and repeated holder subtitles.
  Status/name/phone/email align with the Leads column conventions. Disclosure stays
  after the parent name, without displacing either name's column edge.
- Added explicit `student_id`/`is_student` to list and detail read models. Nonstudent
  holders do not receive an invented Active badge. Staff/student roles can coexist.
- An optional batched, tenant-filtered `account_holders` lookup exposes an explicit
  single holder/person mapping. Missing columns/relation, multiple holders or conflicting
  mappings retain an account summary. No name/address matching or schema migration.
  This lookup is compatibility code with synthetic coverage, not proof of production
  column availability. A holder/student is combined only when that person is present
  in the filtered family. Hidden/filtered identities are never silently selected.
- Minor rows show “Via [holder]”, not personal destination details or repeated adult
  phone numbers presented as the child's number. Holder contact details appear on
  the account row. Saved holder-routing preferences apply to adults too.
- The profile's SMS branch now follows role/routing policy, not phone-string inequality.
  Equal minor/holder numbers still go through the existing server-resolved holder
  composer; missing holder numbers disable SMS. Holder-routed direct Conversations
  email remains disabled. No provider, consent, bulk-recipient or delivery policy changed.
- Existing filtered family selection, Shift anchor reset, real profile callbacks,
  whole-family pagination, polling and on-demand Leads loading remain intact.

### Recovery checks

- `scripts/security/contact-role-presentation.test.cjs`: tenant isolation, explicit
  holder/student identity, non-inference, staff/student roles, minor destinations,
  saved adult routing, optional-schema fallback and denied-request no-query checks.
- `scripts/security/contact-role-page-browser.cjs`: actual Contacts page at
  1440/900/390px with intercepted fictional data; real status badges, aligned names,
  44px row geometry, family selection/collapse, missing-holder disabled SMS and
  equal-number holder-composer handoff. Mutation/provider requests are blocked;
  the recipient-preview POST is intercepted and its selected person IDs asserted.
- Existing family/page and Leads browser runners remain required. Functional and
  computed-style checks do not constitute approval against the unavailable screenshot.
- Review URL: `http://127.0.0.1:3218/dashboard/contacts`. Fictional local data only.
  Screenshots: `/tmp/pulse-recovered-contact-roles-{1440,900,390}.png`.

### Remaining boundaries

Recovery validation completed: 125 targeted tests passed; TypeScript passed;
targeted UI/helper/test ESLint has zero errors (two pre-existing unused-style
warnings in ContactSlidePanel). Synthetic-config production build passed. Family
component, actual Contacts selection/filter page, role-specific Contacts page and
unchanged Leads browser checks passed at 1440/900/390px. Screenshots were inspected
at desktop and narrow widths; the original screenshot is still unavailable.

No production queries, migrations, messages, push or deployment. Actual installed
holder/person FKs, multi-account membership and multi-enrollment projections remain
unverified; the legacy Contacts API still flattens the first student/enrollment.
This slice does not invent a replacement for those contracts or claim full M1 readiness.
Production rollout requires verified relationship mappings and visual review. The
original worktree's in-progress preview/drawer work was not overwritten.

Selectively integrated on top of release baseline `9a58519` in
`/private/tmp/pulse-lead-signal-release`. Not deployed.

## Scope

- Contacts groups filtered/sorted records by explicit `account_id` only. Missing
  holder names use an “Account holder” label, never inferred identity matching.
- Staff, instructor and booking contacts remain standalone. Progressive reveal
  slices whole families, not student records.
- Holder checkboxes atomically select/deselect only currently filtered members.
  They reset the range-selection anchor so Shift cannot select unrelated contacts.
- Corrected the built-in status filter to stop after checking `client_status`,
  rather than also requiring a duplicate status value in `custom_fields`.
- Student names retain existing profile callbacks. Holder roots are display-only;
  they do not invent a holder person ID or change drawer contracts.
- Uses shared `ResponsiveDataTable`, `ControlButton`, `PersonName` and tokens.
  The adapter maps the restored table's detail-row callback to real rows.
- Leads remains on its restored grouped-row implementation. No Leads, shared
  toolbar, density, column preferences, timestamps, polling, messaging delivery,
  or `ContactSlidePanel` changes were copied.
- No required Regarding step or new recipient-policy workflow.

## Validation

- 49 targeted family, bulk-communication, conversation-link, lead-family,
  visible-polling, Pacific-time and column-preference regressions passed.
- TypeScript and targeted ESLint passed; `git diff --check` passed.
- Safe-worktree component fixture at `http://127.0.0.1:3218/lists` passed browser
  checks at 1440/900/390px: holder/child selection, filtered deselection, keyboard
  disclosure, profile handoff, no page overflow and zero API requests.
- Existing Leads browser fixture passed at all three widths: toolbar consistency,
  column persistence, unavailable storage, density, grouped children, signals,
  sorting and no writes.
- Notification browser check passed: once per visible minute, zero requests over
  ten hidden minutes, one resume refresh without a duplicate focus request.
- Actual Contacts page browser checks passed at 1440/900/390px using synthetic
  intercepted API responses, not production records. Checks cover Shift-clicking
  a holder after an unrelated range anchor, preserving filtered-out sibling
  selection, status filtering, keyboard disclosure and the existing profile drawer.
  Selection/filter/disclosure add zero requests; no mutation requests are permitted.
  Profile insights use a seeded fresh cache, and funding reads are intercepted.
  Runner: `scripts/security/contacts-family-page-browser.cjs`, with
  `CONTACTS_FAMILY_REVIEW_URL` pointing to the local Contacts page fixture.
- Installed Next 15.5.22 has no `node_modules/next/dist/docs/` directory. This slice
  follows existing client/table conventions and introduces no Next APIs.
- An unconfigured production build compiled and passed type validation but failed
  collecting API page data (`supabaseUrl is required`). A subsequent full production
  build with explicitly synthetic Supabase configuration passed. This is a packaging
  check only, not production configuration or routing verification.

## Still-open release gates

Production account-holder schema/routing has not been verified. Repository inspection
shows bulk recipient lookup requests both direct student accounts and
`student_accounts`; Contacts grouping uses the list API's explicit account ID.
The existing resolver normalizes phone numbers and deduplicates siblings within one
resolution. Synthetic tests do not establish installed production relationships,
recipient authority, or cross-request/retry delivery idempotency. No delivery code
was changed and no messages were sent by these checks.

Actual Vercel bandwidth, function and request usage remains unmeasured. Reduced
polling and on-demand tabs are verified behaviors, not proof that overage risk is
eliminated. Review authenticated Vercel usage and production metadata separately.

Read-only access follow-up: authenticated Vercel project metadata confirms `pulse`
and its linked team. Both current-cycle usage and project-grouped usage for
October 1–30, 2026 return “Billing cost data is unavailable,” not zero usage. The
CLI resolves its current cycle through October 31, 2026. No usage totals or budget
headroom could be established. Production environment metadata lists the expected
Supabase variable names, but individual reads return no usable plaintext values.
The local Supabase URL targets staging; it was not used as production evidence.
No production database request was issued, and no environment values were logged
or written to disk during these checks.

The prior isolated fictional recipient-policy experiment is not included in this
release integration and is not a prerequisite workflow.