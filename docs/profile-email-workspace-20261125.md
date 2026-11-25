# Profile/email workspace — November 25, 2026

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