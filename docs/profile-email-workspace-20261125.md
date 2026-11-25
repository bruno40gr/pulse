# Profile/email workspace — November 25, 2026

## Update: email envelope spacing and picker visual acceptance

- Added 14px top padding between the aligned email header and From row, retaining
  full-bleed pane structure and the matching profile/composer header boundaries.
- Email acceptance passes at 1440/1076/390px with an explicit envelope-gap check.
  TypeScript, targeted lint and 19 focused email/picker tests pass.
- Added `scripts/security/people-picker-browser.cjs` for a synthetic fixture at
  `/private/tmp/pulse-takeover-browser-20261125/app/people-picker-review/page.jsx`.
  Runs shared picker family/band/event configurations at 1440/390px, checking
  relationships, two-word statuses, hidden email/phone search, selection, tooltip
  reasons and no page overflow. No API calls or production writes are allowed.
- Desktop/mobile picker screenshots and desktop email spacing were visually
  reviewed. This closes the outstanding shared-picker visual acceptance item,
  not authenticated production acceptance of each surrounding workflow.
- Logs: `/tmp/email-spacing-{browser,focused,types}.log`,
  `/tmp/people-picker-browser.log`; screenshots `/tmp/people-picker-*-*.png`.
- Next workflow change remains separating account linking from adding people.

## Update: aligned profile tabs and composer headers

- Profile tabs and the SMS/email toolbar share a 64px desktop baseline while
  composing. The active toolbar publishes its measured height to the workspace;
  tabs stretch to match when a recipient name or holder control wraps.
- Hidden retained channel toolbars cannot overwrite that measurement. Mobile
  remains naturally wrapping; no fixed height clips headings or Send/Cancel.
- Toolbar vertical padding is reduced and a bottom divider aligns with the tab
  divider. Normal non-composing profile tabs retain their existing size.
- TypeScript and 14 focused tests pass. Full suite: 1144/1161, the same 17
  baseline failures; targeted lint has zero errors and two existing warnings.
- Browser checks cover equal heights/bottom edges for SMS and email and a
  deliberately long heading, alongside existing desktop/mobile regressions.
  Logs: `/tmp/profile-header-{browser,focused,types,lint,full}.log`.

## Update: shared participant picker content

- Shared family/student/band/event picker retains two content columns: Contact
  (name with a known relationship/role below) and Details (two-word status max).
- Email, phone and account/family metadata remain searchable instead of being
  concatenated into Details. Longer status reasons are available via title text.
- Callers supply contextual statuses such as Already added, Already registered,
  Seeking band, Already linked and Another family. Selection, eligibility and
  save transports are unchanged. Account rows are explicitly labeled Account;
  separating account linking from person selection remains a follow-up.
- Validation: TypeScript and targeted lint pass; focused tests 40/40. Full suite
  1144/1161 with the same 17 baseline failure names and no new failures.
  Logs: `/tmp/people-picker-{tests,types,lint,full}.log`.
- This content pass has not received a fresh browser visual acceptance run.

## Update: focused, full-bleed composition

- Profile entry labels are now SMS / Email; the actual composer Send action stays
  unchanged. Communication buttons are capped at 320px or available width, with
  single-line, ellipsized email destinations and the full address in the title.
- While SMS or email is open, redundant Call / SMS / Email / Edit Contact /
  Impersonate entry controls are hidden. Contact tabs move directly beneath the
  shared identity header; Cancel restores the actions without discarding drafts.
  Shared context also hides legacy contact/lead entry actions and edit icons.
- Live SMS/email no longer inherit profile-card content padding or the gray outer
  surround. The composer fills its pane; internal toolbar/reply padding and the
  phone preview's subtle background remain intentional.
- TypeScript and 86 focused tests pass; targeted lint has zero errors and five
  existing warnings. Browser geometry covers full-bleed SMS/email, retained tabs,
  restored actions, and constrained long-address ellipsis at 1440/1076/390px.
- Full suite: 1143/1160 pass, with exactly the same 17 failure names as the prior
  history-repair run and no added failures. Desktop/mobile screenshots reviewed;
  `git diff --check` passes.
- Validation logs: `/tmp/sms-fullbleed-{browser,focused,types,lint,full}.log`.
  Production deployment is not verified by local synthetic browser acceptance.

## Correction: restore profile SMS conversations (latest)

This supersedes the earlier decisions to suppress profile SMS history and use an
oversized writing area. Account-holder management selectors are unchanged.

- Contact and lead profile SMS now share conversation bubbles, timestamp/status
  labels, a compact reply box, and the retained smartphone draft preview.
- Desktop conversation and preview columns are equal width; mobile stacks them.
- History comes from the existing tenant-authorized inbox, filtered by normalized
  selected phone. Results are sorted and deduplicated; caches are tenant/phone
  scoped. Holder switches abort stale requests and retain separate drafts.
- Polling uses the existing visibility-aware single-flight helper (60 seconds),
  only while SMS is active. Cancel and switching to email stop the poller.
- Loading, empty history, and failed history remain distinct. Successful sends
  clear the draft, refresh history, and keep the conversation open on both paths.
- TypeScript passes. Focused recipient/layout/history/polling tests: 68/68.
  The new controlled-hook tests cover filtering, sorting, duplicate IDs, status,
  stale-response cancellation, tenant isolation, inactive cleanup, and retry.
- Synthetic browser acceptance at 1440/1076/390px covers equal desktop geometry,
  compact reply height, inbound/outbound bubbles, delayed history loading,
  selected-holder history/drafts, verified send payloads, post-send refresh, and
  retained email behavior. No real messages are sent by this harness.
- Browser clock checks also confirm no polling while email is active or SMS is
  cancelled, and explicit history failure/recovery without a false empty state.
  Desktop contact and mobile lead screenshots were visually reviewed.
- Full suite: 1142/1159 pass, with exactly the same 17 failure names as
  `/tmp/sms-preview-full.log` (no added failures). Targeted ESLint: zero errors,
  12 warnings. `git diff --check` passes.
- Logs: `/tmp/sms-history-{browser,focused,types,lint,full}.log`. Screenshots:
  `/tmp/sms-holder-{contact,lead}-{1440,1076,390}.png`.
- Real Prathima Prodduturi history and production deployment are not verified by
  synthetic local acceptance. Do not treat this as confirmation of either.
- Manage account holders remains pending content agreement: proposal is people
  only, with Contact / Email / Phone / Eligibility columns and relationships
  shown separately, rather than mixed account rows and concatenated Details.

## Correction: retain smartphone preview and select the messaging account holder

- The SMS smartphone preview is intentionally restored, superseding the preview
  removal below. The toolbar stays at the top; the preview sits beside the editor
  when the pane fits and stacks below it with scrolling in narrow panes.
- SMS heading is now `Messaging [recipient name]`. Email retains `Write email`.
  Multiple server-verified destinations expose an `SMS account holder` dropdown
  with holder names and phone numbers. Display-only family summaries are not used
  as delivery authority.
- Contact and lead SMS update the heading, preview and actual send destination
  together. Each destination retains its own draft across switching and Cancel.
  Existing recipient verification, send locks and post-success draft clearing stay.
- Campaign sends optionally include one selected destination. The server resolves
  the complete audience and checks its version first, then requires the selected
  destination to exist in that verified audience before narrowing delivery. Bulk
  callers without a destination keep their existing behavior.
- Browser coverage at 1440/1076/390px includes one/two holders on contact and lead
  components, preview text, heading, separate drafts, Cancel/reopen and selected
  send payloads, alongside existing email regressions. All traffic is synthetic.
  Logs: /tmp/sms-preview-{browser,focused,types,lint,full}.log. Screenshots:
  /tmp/sms-holder-{contact,lead}-{1440,1076,390}.png.
- TypeScript passes; focused coverage 63/63; full suite 1137/1154 with the same
  17 baseline failures and no new failure names. Targeted lint: zero errors,
  12 existing warnings. Production deployment is not verified.

## Update: SMS layout repair and scoped plumbing/performance pass

- Fixed the SMS toolbar/workspace sibling layout with an explicit vertical root.
  Profile SMS now has a top H2/Cancel/Send toolbar and a full-width writing area;
  conversation history and the decorative phone preview remain in Inbox, not the
  profile compose surface. Lead campaign composition also drops its preview in
  this context. Email layout is unchanged.
- Profile SMS Enter inserts a newline; sending uses the explicit Send control.
  Cancel/reopen and failed sends preserve drafts; successful contact sends clear
  them. Existing transports, recipient verification and send locks are retained.
- Embedded Conversations resolves its directory once instead of starting an SMS
  inbox poller. Abort cleanup prevents stale identity updates. Standalone Inbox
  retains visible-tab, single-flight polling and its explicit refresh behavior.
- Live contact profile SMS skips unseen SMS history, including post-send history
  reloads. Lead profile composition skips unused contacts/staff avatar hydration;
  memoized recipient inputs avoid rerunning effects on every SMS keystroke.
- Validation: browser geometry and transport acceptance at 1440/1076/390px for
  real contact and lead components with synthetic APIs; no real messages sent.
  Checks cover top-aligned toolbar, full-width editor, no phone/history,
  newline safety, failed send retention, Cancel/reopen, explicit SMS payload,
  success clear and existing email regressions. TypeScript passes; focused SMS,
  recipient, layout and polling tests 55/55. Full suite 1135/1152, with exactly
  the same 17 baseline failures (failure names compared). Targeted lint: zero
  errors, 12 warnings. Logs: /tmp/composer-sms-{browser,focused,types,lint,full}.log;
  screenshots: /tmp/profile-sms-{1440,1076,390}.png and lead equivalents.
- Production deployment is not verified by this loopback-only acceptance run.

## Update: single header and composer content actions

- Profile header now spans both panes, with one close icon at the workspace's
  top-right on desktop and mobile. The profile identity stays visible while writing.
- Email and SMS use content-level H2 headings (Write email / Write text message)
  with Cancel and the shared primary Send CTA at the top right. Existing send
  validation, transport and error handling remain in their original composers.
- Cancel hides the composer and retains its draft. The header close closes the
  whole profile. Redundant Messaging name/phone and nested conversation headers
  are suppressed only in the embedded profile workspace, not in standalone Inbox.
- Browser acceptance passes at 1440px, 1076px and 390px, including H2 headings,
  one close icon at the far right, one SMS Send button, Cancel/draft retention,
  settings errors, simulated send failures/success and no history requests.
- TypeScript passes; focused tests 53/53; full suite 1134/1151 with the same 17
  baseline failures. Targeted lint: zero errors, 17 warnings in existing
  campaign/contact/lead code. Contacts/family browser regression also passes.
- Logs: /tmp/composer-header-{browser,family,focused,types,lint,full}.log.

## Update: side-by-side composition

The initial view-switching implementation below is superseded by a desktop
split workspace: the profile opens at 50vw; composing expands the same dialog to
100vw with profile left and composer right, each taking half. At mobile widths
(960px and below), the mounted panes switch visibility instead of squeezing into
columns. Closing the composer restores the profile width and retains drafts.

- Shared ProfileComposerLayout is used by live contacts and the contact/lead
  workspace. Existing SMS transports and contextual compose precedence remain.
- Email and SMS are mounted on first use and retained separately, avoiding
  settings reloads when reopening or switching channels. Closing the entire
  profile/reloading still does not provide durable draft storage.
- New live email no longer requests, paginates, polls or shows loading for email
  history. Embedded lead email also avoids loading history after sending. No
  history button is added in this composer-focused change; Inbox is unchanged.
- Recipient/settings loading and error gates remain; send verification, locks,
  routing and payloads are unchanged. Lead profile columns adapt to pane width.
- Validation: 52/52 focused contracts; TypeScript passes; targeted ESLint has
  zero errors and the same five existing warnings. Full suite: 1133/1150 with
  the same 17 baseline failures, no new failures. Synthetic browser acceptance
  covers 1440px, 1076px and 390px, separate SMS/email drafts, actual lead panel,
  settings failures, retained profile state, verified sends and no email-history
  reads. Contacts/family browser regression passes at 1440px and 390px.
- Local logs: /tmp/split-composer-{focused,types,lint,browser,family,full}.log.

## Initial implementation (historical)

## Scope

Implements roadmap item 3: switch between profile and email within the existing
panel width, retaining profile context and the unsent draft. Reuses the existing
email editor, recipients, signature, templates and send transports. No template
management, sticky-note task retirement, calendar/Services changes, schema changes
or production write tests are included.

## Behavior

- Standard ContactSlidePanel and LeadDetailPanel host ProfileEmailWorkspace inside
  their existing panel. Profile and email remain mounted, only the active view is
  displayed. Back returns to the profile without resetting its fields or the email.
- Existing Conversations contextual handoff still takes priority; prototype
  transports retain their previous boundary. Recipient changes remount the email
  workspace so drafts cannot cross people. Changing profile identities remounts
  the wrapper. The lead Previous/Next footer is hidden during email composition.
- LiveContactPanel reuses CommunicationCanvas in compose-in-place mode: Send email
  opens the existing editor directly, not a conversation browser followed by a
  fullscreen drafting panel. Its parent-owned subject/body draft survives Back.
- Initial live recipient and mailbox/sender/signature/template reads settle before
  displaying the composer. Setup failures stay visible. Embedded Conversations
  similarly waits for its initial email setup reads to settle before rendering.
- Recipient resolution, opt-outs, account-holder routing, send authorization,
  expected-contact-email verification and duplicate-submission locking are
  unchanged. Failed sends retain subject/body; successful sends clear them.
- Retention is limited to switching within an open profile. Closing/reloading is
  not durable draft persistence. No database or local-storage email draft feature
  is introduced. Existing template behavior remains; management is a later item.

## Validation

- Focused email/family/template/signoff contracts: 47/47 passed.
- TypeScript passed; targeted lint has no errors and five pre-existing unused
  variable warnings in the legacy contact/lead profile files.
- Loopback-only browser script profile-email-workspace-browser.cjs passes at
  1440px and 390px. Fixture host imports real LiveContactPanel and the standard
  ProfileEmailWorkspace/ConversationComposeLink. Covers delayed sender skeleton,
  one dialog, unchanged width, retained subject/body and profile field, failed-send
  retention, exact verified payload, and success clearing. All APIs intercepted;
  only explicit synthetic Send clicks produce send requests. No real mail sent.
- Full suite: 1132/1149 with the same 17 baseline Gmail fixture/interaction-color
  failures; no additional failures. No authenticated production UI acceptance or
  production deployment verification is claimed.
- Local logs: /tmp/email-panel-{focused,types,lint,browser,full}.log.