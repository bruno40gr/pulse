# Enrollment hub — October 30, 2026

## Implemented preview slice

The existing `/content-studio-prototype/enrollment` destination now starts with a
shared `PageHeader` and `ResponsiveDataTable`. It uses shared buttons, name controls,
search input and empty/notice states. `ProgressStepper` is the only new shared UI
primitive. The calendar/payment editor is dynamically loaded only when opening a
draft, never once per table row. Main navigation remains unchanged pending IA review.

The list shows student/contact fallback, lesson, five validated/reviewed steps,
explicitly recorded opportunity value (no estimated/default prices), and updated
date. Recorded opportunity values use the requested dollar display; authoritative
tenant currency remains an operational integration requirement.
Names and progress controls resume the same wizard. Continue/final save retain
validation; Save & close accepts incomplete data at any step.

## Reviewed UI checkpoint

- Uses the existing dashboard shell, table, name controls, field grids and flat
  panels. The pricing breakdown uses the shared `Disclosure` chevron and
  `typography.bodySmall`, not native triangle markers or page-local 12px text.
- Source provenance is retained in draft data but not shown as a second table line.
  Progress circles have individual hover/focus tooltips without explanatory text
  underneath. Tooltips render outside table overflow and dismiss with Escape.
- Unchanged drafts show Close and perform no save or timestamp update. Field
  changes show Save & close; reverting edits restores Close. Navigation alone
  does not count as a field edit.
- Removed redundant payment-deferral and billing-description sentences; amounts
  and billing-period headings remain visible.
- Another payer is explicit opt-in. Its fields appear only while selected;
  switching to student/guardian hides them while preserving entered details.
  Removing it restores guardian when present, otherwise student.
- Development defaults to eight fictional, varied incomplete records in a
  separate browser namespace. `?mock=0` selects the real-source preview. Production
  does not enable mock data. The former empty third-party-payer mock is normalized
  without modifying real drafts or populated payer details.
- Local review: `http://localhost:3100/content-studio-prototype/enrollment`.
  Authentication remains required. No permanent sidebar link added.

Won lesson and tour inquiries are projected from the existing authenticated,
paginated lead API. Service inquiries are excluded. This projection requires no
new lead write and does not remove inquiry history. Saved edits take precedence
over source refresh. Queue identity is the source lead ID, not a guessed person
match. Person IDs prefixed with `inquiry:` are local labels, not canonical links.
Each student's instrument suggestions and availability are kept separately.
Unrecognized/multiple interests remain unselected. Source consent is not copied.

## Persistence decision and explicit limitations

This is a browser-local **preview**, not the durable operational backend requested
for release. No verified enrollment draft schema exists in this slice. Browser
storage is versioned and scoped by server-verified tenant/person identity, not a
client-selected tenant or name. The page repeats the existing administrator access
restriction and does not alter prototype access rules. Use fictional details.

Storage survives reloads in the same browser/account, but is not shared across
staff/devices and can be removed by clearing browser data. Namespace separation is
not a security boundary against someone with access to the same browser profile.
Corrupt/unknown storage and write failures are visible and never reported as a
successful save. Compare-before-write catches a stale tab but is not a database
transaction or full concurrency guarantee. Won-lead queue entries are projected on
list load, not created transactionally at the lead status transition. Reload to
refresh newly won leads. Existing saved drafts remain if the lead changes status.

Progress requires explicit successful Continue validation and still-valid
preceding data. Proposed availability is rechecked against the existing sample
scheduler when resuming beyond Times and on Continue. Pricing is recalculated by
the existing preview functions. These fixtures are not hosted availability or
production pricing. No reservation, enrollment finalization, payment collection,
message, deployment or live database write is introduced.

Before operational release: implement tenant-authorized server draft storage,
atomic revision checks and unique conversion identity, reliable status-transition
queueing, canonical reviewed person/student linking, live scheduling/pricing
revalidation, authoritative currency, and authenticated intended-environment tests.
Do not treat this browser storage as completion of that backend work.

## Verification

- `npm run test:academy`: original enrollment coverage plus new draft/queue/storage
  tests in `scripts/academy/enrollment-drafts.test.cjs`: **215 passing**.
- `scripts/security/enrollment-hub-browser.cjs`: isolated local lab, fictional data,
  intercepted APIs, three widths (1440, 900, 390), start/prefill, incomplete save,
  reload/resume, completed review, invalidated teacher selection, stale-tab write
  protection, deduplication, search and failed lead loading: **all three widths
  passing**. It forbids non-local
  review URLs and blocks API mutations. Playwright is supplied externally, not
  added as an application dependency.
- Browser checks also verify dollar display, per-step hover/focus tooltips,
  unchanged-close storage preservation, dirty/reverted field behavior, shared
  disclosure typography/icon and removed copy. Targeted fictional payer checks
  passed at 1440/390px: guardian default, explicit add, student/guardian hiding,
  retained details on reselection, and removal fallback.
- Browser screenshots/logs: `/tmp/odeon-enrollment-hub-{width}.png` and
  `/tmp/odeon-hub-{academy,browser,types,lint}.log` (disposable).
- The installed Next 15.5.22 package has no `node_modules/next/dist/docs/` directory.
  The page follows its installed `headers()` Promise declaration and existing
  async request-context patterns. No new framework dependency was introduced.
- TypeScript and targeted ESLint passed; `git diff --check` passed. Additional
  lead-contact/Gmail-settings regression checks passed (17 tests). No new full
  production build or authenticated intended-environment verification was run.