# Live integration follow-up

The live inbox integration now has a separate implementation; see `docs/conversations-integration.md` for backend wiring, existing contact/lead side panels, migration/reconnection prerequisites, validation and remaining limitations. The prototype route and its fixtures remain synthetic and isolated.

# Conversations prototype — desktop layout correction

The design prototype described below remains mock-only in `/Users/brunowong/pulse-gmail-release`. Its historical validation notes do not describe the subsequent live integration; consult `docs/conversations-integration.md` for that work.

## Current product flow

Odeon dashboard → Conversations → contact → SMS / Email → read email inside the contact → Reply below the last email → inline editor → collapsed draft preview in the same chain.

- `/dashboard/inbox/prototype` inherits the authenticated dashboard layout. Conversations is a regular page, not a fullscreen SlidePanel. Dashboard navigation is not inert or scroll-locked.
- Plain contact rows contain names, timestamps and unread counts; no search, channel filters, avatars or channel icons.
- Contact tabs preserve established SMS bubbles and inline reply. Email subjects, history, and reading remain in the contact. Clicking an email row never opens composing, including unsent draft rows.
- Reply, Draft email, New email, and Continue draft open an **inline editor inside the existing email reader**. Contact heading, breadcrumbs, channel tabs and desktop email list stay mounted. The original chain remains above the editor. Templates are opened explicitly in a wide modal, without suggestions or automatic selection.
- Back to conversation returns to reading; Back to contacts and breadcrumbs return to the list. View lead is an in-page mock destination, not a collapse state.
- No Conversations Quick view or expand/collapse control. Generic workspace-header/overlay infrastructure remains separate and unchanged by this correction.

## Layout/component reuse

`PageContainer` supplies **28px page gutters**; `PageHeader` supplies the standard heading hierarchy and section separation. Existing `SurfacePanel`, `SectionTitle`, `Tabs`, `FieldRow`, `Input`, `Button`, `ControlButton`, and `Modal` are reused structurally. Composer padding is 28px; headers/footers use shared spacing. One main surface contains channel navigation/history rather than nested message cards. Reading width is capped at 820px, new-email writing at 920px, and reply editor/reference layout at 1440px. Desktop email subject list is 280px. Desktop first; basic mobile list/reader navigation remains, without a new mobile design.

## Draft ownership/lifecycle

- One page-owned in-memory draft map keyed by mock email-thread id. Recipient/contact context comes from that thread. Reopening replies resumes the same entry.
- Each explicit New email creates an independent draft with a monotonically increasing id. Discard cannot cause id reuse or overwrite another draft.
- Closing/returning and changing contact/channel retain drafts. New-email subjects update unsent rows without turning reading into editing.
- Explicit Discard uses an inline confirmation section, clears only the active draft, and removes its empty synthetic thread. Keep draft retains it.
- Mock Send appends a simulated outbound message, clears its draft and returns to reading. Nothing is sent externally.
- Same-URL history includes composer navigation. Stale Back/Forward entries cannot recreate sent/discarded drafts. The selected in-app presentation needs no cross-tab synchronization.
- All drafts disappear on reload/unmount. No storage, server persistence, cross-tab handoff or browser-tab composer.

## Validation — October 17, 2026

- **289/289** tests passed, including **14** Conversations tests and existing overlay tests.
- TypeScript, targeted ESLint, production build and whitespace checks passed. Build used synthetic localhost Supabase values; it does not validate live integrations.
- Chromium desktop/laptop journey verified 28px gutters, contextual navigation, contact channels, reading without composing, inline composition, draft resume, Back/Forward, no resurrection after send/discard, SMS retention/mock send, templates, HTML sanitization/sandbox, inline discard confirmation, no page errors/external requests.
- Screenshots: `/tmp/pulse-desktop-{contacts,sms,email-reader,email-compose,laptop-compose}.png`.
- Logs: `/tmp/pulse-desktop-{all-tests,tsc,lint,browser,build}.log`.
- **Authenticated review remains blocked:** `http://localhost:3100/dashboard/inbox/prototype` redirects to `/login?next=%2Fdashboard%2Finbox%2Fprototype`. No auth bypass introduced. Standalone testing does not prove authenticated dashboard integration.
- Standalone review: `http://127.0.0.1:3101`, served by `/tmp/pulse-conversations-review`. It wraps the real prototype in an explicitly labeled Odeon-style static navigation rail with other sections disabled. Harness files are outside the repository. The actual app retains its existing dashboard shell.
- Shared overlay hardening was not edited in this correction. Existing contact/staff/campaign callers still require authenticated release review. The separate overlay stress runner exercises accessibility independently.
- Unrelated `/Users/brunowong/pulse` worktree status was compared before/after and is unchanged.

## Reproduce

From `/Users/brunowong/pulse-gmail-release`:

```sh
node --test scripts/security/*.test.cjs
npx tsc --noEmit
npx eslint components/inbox/ConversationsPrototype.tsx components/inbox/PrototypeEmailComposer.tsx scripts/security/conversations-prototype.test.cjs scripts/security/workspace-browser.cjs
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/workspace-browser.cjs
```

The browser runner requires the contextual standalone harness on port 3101; `WORKSPACE_REVIEW_URL` overrides its address. Playwright uses the existing external installation, not a new project dependency. Installed Next.js 15.5.22 lacks `node_modules/next/dist/docs/`; no new Next.js APIs/packages were introduced.

## Channel-first new messages and templates

The contacts-list page header exposes **New message**. Contact and lead full views do not repeat it, and do not include a secondary Back to contacts button; use the Conversations breadcrumb to return. Its modal asks for SMS or Email first. SMS uses quick search and one-at-a-time selection with removable chips, then a compact writing step with separate personalised previews. Mock Send adds an outbound SMS to each selected contact, never a group thread. Close retains the selection/text; explicit discard confirms. A retained new-message flow resumes rather than creating a competing draft.

Email selection uses To plus optional Cc/Bcc. Contacts cannot be duplicated across fields. At least one valid To recipient is required; missing-channel contacts cannot be selected. Continue opens the inline email composer, where the same fields remain editable and are retained with the draft. Mock sending records the same email in each recipient's local history; To/Cc metadata is visible, while Bcc is not placed into message bodies or public recipient metadata. This models one email, not a personalised bulk email campaign. Changing recipients does not delete the original reply history.

Templates are available in inline SMS replies, the new SMS composer, and the email composer:

1. **Templates** opens a channel-scoped searchable library and preview.
2. **Create template** adds a named plain-text template (plus subject for email).
3. **Save as template** starts creation from the current draft, without recipients or the email signature. Rich formatting is flattened when saving; existing sample email templates retain their HTML when applied.
4. **Insert into draft** preserves existing writing and a nonempty subject. **Replace draft** confirms before replacing nonempty text/subject. **Undo template** restores previous content without reverting recipient changes.
5. Supported variables are `{{firstName}}` and `{{student}}`; unknown variables and duplicate template names are flagged. SMS resolves variables separately per recipient; multi-recipient email uses a neutral greeting. Applying email templates adds one signature.

Custom templates are held at page level, reusable across contacts during this preview session, and separate for SMS/email. No backend, import/upload, shared library permissions, template editing/deleting, attachments, or persistent storage is implemented. Reload resets custom templates and drafts.

Channel-flow validation: **294 tests passed**, including 19 Conversations tests. Both the existing desktop/history browser journey and the new channel/template journey pass with no page errors or external requests. New runner:

```sh
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/channel-compose-browser.cjs
```

Screenshots: `/tmp/pulse-channel-{choice,sms-recipients,sms-write,email-recipients,email-compose,template-library}.png`. Logs: `/tmp/pulse-channel-{all-tests,browser,history-browser,build,tsc}.log`. Existing authenticated integration limitation remains unchanged.


## Earlier email toolbox revision — superseded below

New email drafts open inline in the email reader. The Templates button opens the wide modal only on request; nothing is preselected. Write from scratch, Escape, the close control, or the backdrop dismisses the library without leaving the draft. SMS keeps its existing template modal.

Validation: 294 tests, targeted ESLint, TypeScript and both browser journeys passed. The channel journey checks automatic email-toolbox opening, drawer presentation, discoverable placement above subject, and absence of the redundant buttons. Screenshot: `/tmp/pulse-toolbox-email-start.png`. Authenticated integration remains unverified; preview drafts/templates remain memory-only.

Production build compiled and passed its type-check phase, but page-data collection failed for `/api/account/recovery` because this worktree environment lacks the required Supabase URL (`supabaseUrl is required`). No live service connection was added. The standalone review preview remains available on port 3101.


## Contact email and template gallery — October 17, 2026

Inside a contact’s Email tab, **New email** / **Draft email** opens a signed email draft addressed to that contact directly. It does not open the global SMS/email chooser. Global New message keeps its channel-first flow. Email reader and composer breadcrumbs stop at **Conversations → contact name**; the subject stays in the content area.

Email templates now use the shared wide modal, not a narrow side drawer. Search covers name, subject and body; a category selector filters a preview-card gallery. Results paginate at 12 per page. Selecting a card shows its readable message preview without editing the draft. The primary **Use template** action applies it; existing text/subject triggers replacement confirmation with an optional **Insert instead** path. Create/save, neutral multi-recipient substitutions and undo remain supported. SMS keeps its existing modal.

Outreach suggestions, history explanations, recommended sorting and automatic template selection have been removed. Search, categories, pagination, preview and explicit Use template remain. A template named Friendly follow-up is still available as an ordinary library item, not a suggestion. Historical sequence helper functions remain unused by the UI; they do not affect selection or drafting.

Research references: official Mailchimp “Access Your Saved Email Templates”, Constant Contact “Select an email template” and Brevo “Create an email template” documentation. Adapted browsing/search/category, preview-before-apply and explicit Use template patterns to short contact messages rather than newsletter design.

Validation: **296 automated tests**, TypeScript, targeted ESLint, existing channel and workspace browser journeys, and the new template-library journey passed. The new runner covers direct Alex drafting, contact-only breadcrumb, recommendation/progression/end-of-sequence, category/search, 14-template pagination, mobile overflow and Escape/focus restoration.

```sh
PLAYWRIGHT_MODULE=/Users/brunowong/HarmonyExport/node_modules/playwright node scripts/security/template-library-browser.cjs
```

Screenshots: `/tmp/pulse-library-alex-recommended.png`, `/tmp/pulse-library-mobile.png`. Logs: `/tmp/pulse-library-{all-tests,tsc,lint,browser,history,gallery,build}.log`. Production compilation and build type checking succeeded; page-data collection remains blocked by missing Supabase URL, this time in `/api/account/claim`. Authenticated dashboard integration remains unverified. The static navigation preview is still served on port 3101. Nothing committed or deployed.


## Inline email simplification — October 17, 2026

- Email rows show the latest message direction: teal ↗ outbound, crimson ↙ inbound, each with an accessible label and tooltip. Message headers use the same indicators. Unread threads show a teal dot; opening the thread clears its thread/message unread state. Alex’s latest inbound email is seeded unread so this is reviewable.
- Reply is below the last email. The editor stays within the same reader; the contact name, channel tabs, breadcrumbs and desktop list remain unchanged. New email uses that same panel too.
- Save & close collapses the editor to a Draft card at the bottom of the chain, with recipient and message preview. Switching to another email or channel also collapses it without losing text. Continue draft resumes it. List rows show a draft snippet as well.
- Discard confirmation is inline rather than a modal. Templates open only when requested, with no suggested follow-up, recommendation explanation or preselection. The existing global New message flow is unchanged.
- Draft previews are memory-only like the rest of this mock; reload/unmount clears them. No live delivery or persistence was added.

Latest validation: 297 automated tests, TypeScript and targeted ESLint; channel-compose, workspace and template-library browser runners; an additional desktop/mobile journey for unread clearing, direction, draft placement, thread-switch resume and overflow. Screenshots: `/tmp/pulse-inline-desktop.png`, `/tmp/pulse-inline-mobile.png`. Logs: `/tmp/pulse-inline-*.log`. Production build compiles and type-checks, then page-data collection fails on missing Supabase URL in `/api/access/demo`. Authenticated dashboard/overlay integration remains unverified. No commit or deployment.


## Compact contextual composer — October 17, 2026

This revision supersedes the earlier composer controls and Save & close label:

- Direct contact new emails and replies lock To to that contact, with no recipient search or Cc/Bcc controls. Global New message retains its editable multi-recipient flow.
- Write, Preview and Templates share the compact header. HTML editing is removed. Save as template is available inside the template library rather than taking another composer row.
- Footer: Save as draft and Discard draft on the left, Send email on the right.
- Replies retain their email chain above the editor. Direct New email also retains a reference to the current/most recent non-empty email thread for context, without copying those messages into the new email's sent history. View previous email and a sticky Back to draft control navigate within the same scrollable reader without losing text.
- Signature is rendered separately below the editable body and appended once on mock send and preview. Template replacement, undo and selecting all body text cannot remove it. Its name comes from the existing useIdentity provider, with HTML escaping. The standalone harness has no authenticated identity and explicitly shows “Admin identity unavailable in this preview”; academy email/phone/logo remain sample values. No saved personal-signature settings or personal sender mailbox are exposed by the current identity contract; authenticated integration remains unverified. No additional identity fetch or live messaging was added by the prototype.

Validation: 298 tests, TypeScript, targeted ESLint, git diff --check, all three repository browser journeys, plus desktop/mobile compact-composer review passed. Additional checks cover fixed Alex recipient, absence of search/Cc/Bcc/HTML, header/footer arrangement, previous-thread navigation retaining text, signature fallback and draft resume. Screenshots: `/tmp/pulse-lean-compose-desktop.png`, `/tmp/pulse-lean-compose-mobile.png`. Logs: `/tmp/pulse-lean-*.log`. Build compiles/type-checks but page-data collection remains blocked by missing Supabase URL, this run at `/api/account/me`. Preview remains on port 3101. Uncommitted and undeployed.


## Quiet context and responsive composing — October 17, 2026

Supersedes the earlier history shortcuts and header template placement:

- Removed the email-history/scroll-up banner, Back to draft and View previous email. Opening a composer scrolls only its containing reader, leaving up to 96px of actual preceding email visible. The chain remains scrollable above it without extra explanatory controls.
- Added a bordered Message input area containing a formatting toolbar, editable body, signature and preview. Use template sits in the toolbar, opening the existing preview/explicit-use library modal. Formatting is disabled in preview mode. No HTML mode, recipient search or suggestions were reintroduced.
- Removed Emails and New email from the left-hand email list. New email is available beside the active reader subject; empty-history Draft email and global New message remain.
- Conversation height now follows dynamic viewport height rather than imposing a 640px minimum; mobile page/panel gutters shrink; the desktop list uses a clamped width; controls wrap in narrow views and the body uses at least 16px text. The list/reader remain separate on narrow screens. Long content scrolls within the reader, with footer actions reachable.
- Official design references: HubSpot Create and send message templates (Templates inside the email composer) and Microsoft Create email templates in Outlook (template access from the message interface). This prototype chooses a visible in-context button rather than a hidden menu. No third-party integration added.

Validation: 298 tests, TypeScript, targeted lint, whitespace checks, channel/workspace/gallery browser journeys, and the new responsive-compose browser runner. Nine viewports: 1920x1080, 1440x900, 1280x720, 1024x768, 820x1180, 768x640, 390x844, 320x568 and 844x390. Runner asserts actual prior-email visibility above the composer, no banner/return controls, bounded input, in-box template access/modal overflow, retained drafts, reachable footer and no page/reader horizontal overflow. Screenshots `/tmp/pulse-fold-{1440,390,320}.png`; logs `/tmp/pulse-fold-*.log`. Standalone preview only; authenticated dashboard navigation and identity integration still require release review. Mock-only, memory-only, uncommitted and undeployed.

## October 17, 2026 — simplified v0 library and clean new-message view

Supersedes the earlier searchable/category-based library and inline template creation:
- Email library displays all eight seeded templates, with explicit selection/preview/application. No search, category, pagination, creation, save-as-template, or session disclaimer. SMS uses the same selection-only library with its two seeded SMS templates. Management is reserved for settings; no settings editor was added.
- A horizontal rule separates prior email context from its composer.
- Switching from email composition to SMS collapses and retains the in-memory draft, with a saved status. Returning to Email and opening its thread exposes Continue draft.
- SMS has a live smartphone preview (shown initially, collapsible); the global SMS modal previews separately resolved recipient messages in phone frames.
- Contact rows wrap responsively. Main list supports text search and inclusive From/To date filters against latest message activity across channels. Synthetic relative labels receive local-date timestamps for filtering.
- Removed root breadcrumb duplication and prototype subtitle.
- Global email compose is standalone, without contact heading, channel tabs, thread list or old email context. Saved global drafts resume from the main list into that same clean view. Mock send returns to the main list and adds history to selected recipients.

Validation rerun from `/Users/brunowong/pulse-gmail-release`: 301/301 security tests; TypeScript; targeted ESLint; four existing Playwright journeys (including nine-viewport responsive composition); new `scripts/security/conversations-v0-browser.cjs` across five viewport sizes. New journey checks main-list filters/overflow, divider, email-to-SMS draft retention, phone preview, and clean global multi-recipient compose/save/resume. Logs: `/tmp/pulse-v0-*.log`; clean compose captures: `/tmp/pulse-v0-clean-compose-{1440,820,390,320,844}.png`.

Production build compiles and validates types, then fails page-data collection for `/api/account/claim-reminder` because `supabaseUrl` is missing. No commit/deployment, persistence, or live messaging. Authenticated dashboard integration remains unverified; review server remains at `http://127.0.0.1:3101`.

### SMS partition correction — October 17, 2026
Checked the existing `components/campaigns/ComposePanel.tsx`: its desktop SMS form and phone preview are side-by-side with a vertical divider. Corrected the prototype to follow that pattern rather than embedding the phone above the input. Contact SMS now has history/composition left and a separately scrollable preview pane right at desktop widths (1000px+), consistent with the email workspace's partition treatment. New-message SMS uses the same form-left/preview-right layout in a wide modal. Narrow screens retain stacked previews without horizontal overflow. No unrelated UI refinements or in-app integration were made.

Validation: 301 tests, TypeScript, targeted ESLint, whitespace checks, and all five browser runners pass. Added browser assertions for right-hand preview placement in both SMS entry points and the contact preview's vertical border. Logs: `/tmp/pulse-sms-partition-*.log`. No commit or deployment.

### Matching 30/70 widths — October 17, 2026
Both desktop channel workspaces now use `minmax(0, 3fr) minmax(0, 7fr)` (30% left / 70% right), replacing fixed/clamped pane widths. Global new-message SMS uses the same split. Narrow-screen behavior is unchanged. Browser checks explicitly measure the email, contact SMS and new-message SMS ratios. Validation: 301/301 tests, TypeScript, targeted lint, all five browser runners and whitespace checks pass; logs `/tmp/pulse-3070-*.log`. No commit or deployment.

### SMS templates removed — October 17, 2026
SMS follows the existing design and does not expose templates. Removed template entry points, template undo state, and template props from both contact SMS and global new-message SMS. Email template behavior is unchanged. No other SMS redesign in this change. Validation: 301 tests, TypeScript, targeted lint, whitespace checks, channel-compose browser journey and five-viewport conversations-v0 journey pass. Browser assertions now enforce absence of SMS template controls. No commit/deployment.

### Contact header and channel picker — October 17, 2026
Removed conversation breadcrumbs in favor of a top-right Go back to Conversations link. View lead now sits directly beside the contact name via an optional shared PageHeader titleAction slot; it no longer appears in the channel container. Existing PageHeader consumers keep their defaults.

Channel selection now reads Send a new message / How would you like to reach out? with equal neutral SMS and Email controls in two columns, including mobile. Removed the session disclaimer, descriptive channel copy and channel-stage footer; the header × remains the only close control. Recipient/write stages retain Back and relevant actions. SMS remains template-free; 30/70 splits and draft retention are unchanged.

Validation: TypeScript, targeted ESLint, whitespace checks and all five browser journeys pass, including equal-size/equal-style channel buttons, no breadcrumbs, View lead placement, responsive widths and draft behavior. Logs: `/tmp/pulse-header-picker-*.log`. No commit or deployment.

### Filters outside the conversation table — October 17, 2026
Checked Contacts and Leads filter/table placement. Conversation search and inclusive From/To date controls now sit in a separate region above the bordered list panel, with aligned edges and spacing. Search receives more horizontal space on desktop; controls stack at mobile widths. Filtering, clear/reset, draft rows and channel layouts are unchanged. Browser coverage verifies the filter region is outside and above the table panel at five viewport sizes. Validation: 301 tests, TypeScript, targeted lint, whitespace checks and all five browser runners pass (`/tmp/pulse-outside-filters-*.log`). No commit/deployment.


### New-message reset and full-width list — October 17, 2026
- Closing the New message modal resets its channel, selections, search, and unsent SMS body. Reopening always starts at the SMS/Email channel choice; standalone email drafts are unchanged.
- Removed the explanatory To/Cc/Bcc paragraph.
- Extracted the existing ComposeModal recipient UI into `SmsRecipientPicker` and reused it for prototype SMS selection with mock data, without live API/send integration. The existing live picker retains its Everyone/Staff controls.
- Removed the Conversations list's 1000px cap. Filters and table fill the available content width while preserving page gutters and mobile stacking.
- Validation: 301 security tests; TypeScript; targeted ESLint; whitespace check; all five browser journeys. Added modal reset/cleared SMS assertions, removed-copy assertion, and full-content-width checks across five viewports. No commit or deployment.


### Full-page multi-recipient SMS composer — October 17, 2026
- Kept channel-first New message and the shared recipient picker modal. Write SMS now closes the modal and opens a full-page workspace titled **Write a text message**, with **Go back to Conversations** and no redundant Email tab.
- Reused `PrototypeSmsConversation` for the SMS controls and phone previews: 30/70 desktop split, stacked narrow layout, separate personalized previews, mock-only individual delivery.
- Selected recipients remain visible and editable using the shared picker. Editing preserves the body; empty recipient selections disable sending. Sample AI greetings use each recipient's first-name placeholder for multi-recipient messages.
- In-memory workspace text survives Back/Forward navigation. Starting a new message starts fresh. Sending or confirmed discard clears the workspace; stale history cannot resurrect it. Discard requires confirmation.
- Validation: 302 security/unit tests, TypeScript, targeted ESLint, whitespace checks and all five browser journeys pass. New coverage checks full-page handoff, no channel tabs, recipient edits, empty-selection send blocking, draft navigation, and send/discard history safety; responsive flow exercised at five viewport sizes. Screenshots reviewed locally. Logs: `/tmp/pulse-fullsms-*.log`.
- No live messaging integration, commit, deployment, or production-build retry. The previously documented Supabase build/integration limitation remains.

### Single, always-visible SMS preview — October 17, 2026
- Corrected the prototype's multi-recipient presentation to one smartphone preview, not one per recipient. It uses the first selected recipient for sample personalization and retains one generic preview when the selection is empty.
- Removed preview show/hide controls from the shared prototype SMS UI. The preview is always rendered on desktop and narrow screens.
- Moved Discard text message into the top recipient section beside Edit recipients; actions wrap on narrow screens. Discard confirmation remains unchanged.
- Recipient selection, mock individual delivery, and live multi-SMS implementation are unchanged.
- Validation: 302 security/unit tests, TypeScript, targeted ESLint, whitespace checks, and all five browser runners pass. Added assertions for exactly one visible smartphone, no preview toggle, and both actions above the workspace at five viewport sizes. Desktop and 320px screenshots reviewed. Logs: `/tmp/pulse-single-sms-*.log`. No commit/deployment.

### Confirm leaving an unsent SMS — October 17, 2026
- Go back to Conversations now warns when the new full-page SMS composer contains non-whitespace text: “Going back to conversations will discard the current message”.
- Continue clears the current new SMS and returns to Conversations. Cancel, Escape, backdrop dismissal, and the close button preserve the text and recipients. Empty/whitespace-only messages return directly without confirmation and clear the empty composition.
- Existing contact SMS drafts, email navigation and browser Back behavior remain unchanged; the guard applies to the explicit Go back to Conversations control in the new SMS workspace.
- Validation: 303 tests, TypeScript, targeted ESLint, whitespace checks and all five browser journeys pass. Coverage includes empty/whitespace/one-word text, cancel preservation, Escape, confirm-to-discard and stale history safety across five viewport sizes. Logs: `/tmp/pulse-leave-sms-*.log`. No commit/deployment.

### Alex's previous SMS conversations mock — October 17, 2026
- Added six read SMS fixture messages (incoming/outgoing across the previous three weeks) before Alex's existing latest inbound message. Historical timestamps remain chronological and do not increase unread counts.
- Selecting only Alex via New message → SMS → Alex Chen → Write SMS now passes his existing SMS thread into the shared workspace, displaying scrollable history above the composer. The same fixture history is visible when opening Alex from Conversations.
- Single-recipient history starts at the latest message; scroll up for older exchanges. Retained one always-visible smartphone preview, leave/discard confirmation, and editable recipients.
- Multi-recipient composing does not display combined histories. Editing recipient selection preserves the draft and resolves the correct person's thread when returning to one recipient.
- Validation: 304 tests, TypeScript, targeted ESLint, whitespace checks and all five browser journeys pass. Five-viewport checks cover history availability, scrolling, initial latest-message position, one preview, and recipient-edit draft retention. Desktop/mobile screenshots reviewed. Logs: `/tmp/pulse-alex-history-*.log`. Mock-only; no live messaging, commit or deployment.

### Single-recipient entry opens the personal conversation — October 17, 2026
- New message → SMS → one recipient → Write SMS now opens that person's existing conversation page with SMS selected, rather than the standalone new-message workspace. The normal contact title, View lead and SMS/Email history tabs are retained; there is no bulk recipient-edit/discard header.
- Existing personal SMS drafts and history are reused. Opening the SMS conversation marks its SMS history read. A contact without SMS history uses the same personal conversation empty state and can send a mock first message there.
- Multiple recipients still open Write a text message, with one preview, recipient editing, discard confirmation and the existing leave warning. Personal conversation draft-retention/navigation behavior is unchanged.
- Validation: 305 tests, TypeScript, targeted ESLint, whitespace checks and all five browser journeys pass. Tests cover Alex's prior history, explicit SMS selection despite remembered Email context, retained drafts, first SMS without history, and unchanged multi-recipient flow across five viewport sizes. Desktop/mobile screenshots reviewed. Logs: `/tmp/pulse-personal-sms-*.log`. No live messaging, commit or deployment.
