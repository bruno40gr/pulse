# Profile/email workspace — November 25, 2026

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