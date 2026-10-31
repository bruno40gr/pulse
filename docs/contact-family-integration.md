# Contacts family integration — release review

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