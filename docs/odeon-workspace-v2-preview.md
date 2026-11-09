# Current review prototype: three-tab panel

This section supersedes the earlier single-page panel description below.

- Opt in at `/students?prototype=v2`; V1 remains the default and is unchanged by this pass.
- Panel tabs: **Account | Upcoming lessons | Notes**, below the shared communication action row.
- Account uses two columns where the panel has enough room: combined contact/account-manager details, billing and makeup credits on the left; subscriptions on the right. Narrow panels stack. Account managers no longer has a separate card in the V2 panel. View billing and Book makeup open existing full-workspace destinations.
- Upcoming reuses V1's `UpcomingBookings` dated list, including booked makeups and Load more. It does not use the newer list/calendar browser in the panel. Lesson Move/Cancel opens the existing workflow.
- Notes keeps shared/internal audience selection in one tab, rather than repeating full notes under Account.
- The header restores View Account Details, opening the account workspace. The communication-history shortcut is removed. SMS/email remain disabled; future history entry belongs inside those composers, not in a separate panel action.
- Subscription menus and Add subscription retain the existing management/enrollment workspace. This does not implement the broader Opus-reference subscription capabilities.
- Workspace Back returns to the originating panel tab; successful subscription/payment save returns to the panel. Contacts stays mounted with search and selection retained.
- Billing totals use scoped preview invoices, not a live account ledger. Communication remains disabled preview-only. Makeup counts include unused preview credits, excluding booked replacements.
- Validated TypeScript, targeted ESLint, 195 academy/dialog tests, V1 browser regression and the updated V2 journey at 1440/1366/900/390px. V2 checks cover three tabs, summaries, future lesson cancellation, credit count updates, makeup booking entry, account workspace CTA, merged contact card, responsive column alignment, payment, subscription update and retained contacts state.
- Screenshots: `/tmp/odeon-v2-account-{1440,1366,900,390}.png`.

# Workspace V2 exploration

This is an opt-in alternative, not a replacement for the existing student/family prototype.

## Compare locally

- Original: `http://127.0.0.1:3197/students`
- V2: `http://127.0.0.1:3197/students?prototype=v2`
- V2 Sophie quick reference: `http://127.0.0.1:3197/students?prototype=v2&view=quick&account=preview%3Akim&student=preview%3Asophie&section=profile`
- V2 Sophie schedule: `http://127.0.0.1:3197/students?prototype=v2&view=staff&account=preview%3Akim&student=preview%3Asophie&section=enrollments`

The development-only, authorized application route is `/content-studio-prototype/students?prototype=v2`. The local lab exposes it at `/students`, as before. Production route guards are unchanged.

## Interaction boundary

- Panel: one page, no tabs. At 760px of panel content width, account details and subscription cards sit on the left with internal notes aligned at the top on the right. Narrower panels stack those sections. Gray `colors.surfaceMuted` canvas, white shared cards, standard `DenseSectionPanel` padding/spacing, and the existing `AccountManagersPanel` preserve the component system. Contact summaries avoid repeating the header name. Subscription cards retain program, status, level, recurring schedule, instructor, payer/card summary, and management entry points; configuration still opens the full workspace. Includes mentions and sticky-note task controls.
- The existing `SlidePanelActionBar` renders Call, Send SMS, and Send email below the header on white. Actions remain disabled with explanatory titles in this local preview, matching V1; no live communication integration was added.
- Panel navigation: one **View Account Details** CTA in the header's top-right actions slot opens the full workspace's Account section. No shortcut button row or per-child navigation buttons; note actions remain in context.
- Upcoming classes stays out of the V2 panel pending discussion; Schedule remains available inside the workspace.
- Workspace: full viewport, with no visible application sidenav. Section order is Account, Notes, Schedule & lessons, Billing, Comms, Makeups. Account contains contact/family details but no follow-up or subscription cards. Student/family-shared notes live in Notes, separately from the panel's internal staff notes; Comms contains message history only.
- Schedule & lessons defaults to an eight-week dated lesson list, with a program filter, date jump and In 4 weeks shortcut. Selecting a row shows details and direct Move/Cancel actions to the right; mobile replaces the list with focused details and Back to lessons. Cancellation is confirmed inline for recurring lessons; makeup replacements retain their existing cancellation workflow. Optional Calendar shares the selected lesson with the details pane. Date jumps generate preview occurrences through the following eight weeks.
- Manage subscriptions opens the existing subscription cards and lifecycle menus separately from lesson browsing. Panel subscription summaries remain unchanged.
- V2 subscription management supports local level/duration updates, freeze/resume, and confirmed cancellation. Frozen/cancelled subscriptions hide future calendar entries without deleting historical invoices or lesson records. Resume restores frozen entries. These are immediate prototype transitions, not billing/refund/effective-date/conflict-aware production operations. Recurring teacher/time changes are not implemented.
- The outer back caret returns to the same student's/account's slide panel. X dismisses directly to Contacts. In-workflow back controls return to the preceding workspace section.
- Contacts stays mounted under the full-screen dialog, preserving its current search, selected rows, and existing table state. The existing dialog stack handles focus, background inertness, and scroll locking/restoration.
- This does not add sorting or pagination controls that the current preview table does not have.
- Preview data and notes remain component-local. Reloading or switching prototype versions resets them; this is not a production payment, messaging, or persistence integration.

## Preservation

`StudentWorkspace.tsx` is unchanged. `StudentPreview.tsx` selects the independent `StudentWorkspaceV2.tsx` only with `prototype=v2`. Shared sections have opt-in V2 presentation flags; defaults retain V1 behavior.

A snapshot of all pre-existing modified/untracked files was saved before implementation:

`/Users/brunowong/odeon-preview-snapshots/before-workspace-v2-20261104-210658.tar.gz`

The adjacent `.tar.diff` contains the tracked binary-capable diff. The archive contains the untracked student/family files as well, which a plain Git diff would omit. This is a filesystem checkpoint, not a Git commit. No reset, stash, or checkout was performed.

## Validation

Run from `/Users/brunowong/pulse-odeon-integration`:

```sh
npx tsc --noEmit
npx eslint app/content-studio-prototype/students/StudentWorkspaceV2.tsx app/content-studio-prototype/students/StudentPreview.tsx app/content-studio-prototype/students/LessonsBrowser.tsx app/content-studio-prototype/students/WeeklySchedule.tsx app/content-studio-prototype/students/WorkspaceSections.tsx app/content-studio-prototype/students/page.tsx scripts/security/student-workspace-v2-browser.cjs
node --test scripts/academy/*.test.cjs scripts/security/dialog-stack.test.cjs
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/student-workspace-v2-browser.cjs
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/makeup-preview-browser.cjs
git diff --check
```

The V2 browser test checks 1440, 1366, 900, and 390px at 768px viewport height: responsive columns/stacking, subscriptions and internal notes visible on laptops, shared card padding and gray canvas, communication action availability, no horizontal overflow, top-right CTA opening Account, section order, Account exclusions, student Notes, program filtering, four-week date jump and single-lesson cancellation, list/calendar switching, subscription management access, level update, freeze/resume, confirmed cancellation, payment, statement PDF download, Comms, makeups entry, and distinct back-to-panel/X-to-table behavior with retained table DOM/search/selection. Model tests also verify scope checks, immutability and invoice preservation for lifecycle operations. Standard airy spacing takes priority over fitting every subscription above the fold. Shell APIs are mocked; unexpected domain API calls and browser exceptions fail the test.

Screenshots: `/tmp/odeon-v2-internal-{1440,900,390}.png` and `/tmp/odeon-v2-lessons-{1440,1366,900,390}.png`.