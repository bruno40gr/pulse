# Conversations integration

## Email history review

- Conversations can be sorted by name, latest contact timestamp, or contact date, ascending/descending. Missing timestamps remain last.
- The email reader defaults to the most recent received/sent thread; it never asks the user to select a loaded email. Contacts without history have an explicit no-history state.
- SMS/Email use the Settings `ControlButton` tab styling. Workspace height follows available viewport space while the phone keeps its fixed dimensions.
- Lead/contact detail and edit drawers use the same shared width (`min(75vw, 960px)`), fullscreen on mobile. Both use `ProfilePanelSkeleton` for profile loading.
- Clicking the active Conversations sidebar link resets the workspace to the conversation list and refreshes directory/SMS data without dropping saved email drafts.

- Opening a contact loads connected-mailbox email history without requiring the Email tab first. Existing pagination and tenant/member authorization remain unchanged.
- The verified staging email preview uses per-contact sample threads only when the mailbox lookup succeeds and returns no connected mailboxes. Messages are labeled **Sample email** and are never stored or sent. Connected mailboxes use provider history instead.
- The conversation list no longer repeats “Email history not loaded” for every contact. Unread email counts appear once history is available.

## Release operations

- With operator approval, the `gmail_conversations` migration was applied and verified in staging (`20261018201130`) and production (`20261018201155`). It adds only the non-null `scopes` array with a read-only default; it does not grant Google permission.
- Production verification found one existing connection, correctly retaining read-only scope metadata, and no connection error. No tokens or message bodies were queried.
- The hosted production build passed configuration verification, compilation, type validation and generation of all 89 static pages. Deployment `dpl_2vcG1CUjGQAiQ1JahqDwTrcXaBvB` was then successfully promoted to the live domains. Previous production deployment for rollback: `dpl_HWQQJgjLMqEnyoh3b6zQP3fS6TRi`.
- Post-promotion checks on `app.headlinerma.com` confirmed the new email endpoint returns HTTP 401 without authentication, and the inbox redirects to login (HTTP 307). Authenticated/provider sending is not yet verified; the operator must reconnect Gmail before sending is enabled.

## Implemented

### Card shortcuts follow-up (local, not deployed)

- Lead and contact detail cards offer **Send email** and **Send SMS** buttons opening an addressed composer drawer. It uses the same `PROFILE_PANEL_WIDTH` (`min(75vw, 960px)`) as profile cards, and fullscreen on mobile. Closing returns to the underlying card without navigating or opening another tab.
- The drawer resolves stable directory IDs against the active account, including explicit deduplication aliases. It does not take arbitrary routing destinations or modify the underlying page's URL/workspace history.
- Email opens an addressed draft even without a connected mailbox; Gmail consent is still required to send. Its drawer layout omits the full Conversations heading, directory and profile shortcut.
- Card SMS restores the original production `ComposePanel` (attachments, AI drafting, character count, phone preview and Send message footer) as a deeper view **inside the same profile drawer**, not a second dialog. An explicit back arrow returns to the lead/contact card. The lead Previous/Next footer is hidden while composing. Existing production recipient IDs and lead attribution are retained.
- Inside Conversations, **View lead → Send SMS/email** dismisses the profile and returns to the existing channel composer, rather than stacking a second composer over the workspace. SMS drafts remain intact; an active email draft is reused.
- Existing account-holder SMS routing remains on the legacy compose flow. Account-holder-only email routing is disabled with an explanatory tooltip until Conversations supports it; it never silently substitutes the student's address. Instructor and bulk compose behavior are unchanged.
- Local validation covers recipient resolution, matching composer/card widths, returning to the card, contextual composing and no popup/send on open at desktop/mobile widths. `card-composer-drawer-browser.cjs` uses the isolated `/cards` review fixture. No real messages are sent by these mocked journeys. This follow-up has not been deployed.

- `/dashboard/inbox` renders `components/inbox/Conversations.tsx`; the synthetic `/dashboard/inbox/prototype` remains isolated for design regression tests.
- SMS history, read state and personal replies use the existing inbox endpoints. Campaign query filtering remains supported. SMS is refreshed every 15 seconds.
- Single-recipient SMS opens the personal conversation, preserving the in-memory draft; recipients without history have an empty personal conversation.
- Multi-recipient SMS retains the separate workspace and routes its review/send action through the existing production `ComposePanel` and campaign APIs. Production bulk sending is unchanged. `{{firstName}}` is translated to the production `{first_name}` token at this boundary.
- **View lead** opens the existing `ContactSlidePanel` or `LeadDetailPanel` according to the resolved profile. It does not navigate to the prototype lead page. Closing leaves history and drafts intact. Unknown phone-only threads have the action disabled.
- `/api/conversations` returns a complete, paginated tenant directory, restricted by contact/lead read permissions; profile IDs remain distinct from messaging recipient IDs.
- `/api/conversations/email` lists the signed-in member's connected mailboxes, reads contact-related Gmail threads with explicit pagination, and sends new mail/replies through Gmail. Communication read/send permissions are checked before provider access. Mailbox tokens are server-only, tenant/member scoped, and never returned to clients.
- OAuth requests `gmail.readonly` plus `gmail.send`; connection scope metadata gates sending. Existing read-only grants require reconnection. Read/unread email indicators reflect provider state; reading in Odeon does **not** mark Gmail messages read. Email history is loaded on opening the channel, with Refresh email and Load more emails actions; email counts are explicitly labeled as unloaded/loaded-history counts, not whole-mailbox totals.
- Plain-text provider bodies are displayed as text, not untrusted HTML. HTML-only messages direct the user to Gmail; attachments are not downloaded or displayed. Bcc is used for sending but never exposed in returned history.
- New messages have editable rich-text bodies but no synthetic identity/signature. No production email templates were invented; the email template list is empty pending real template management.
- Failed sends preserve drafts. Submit controls are disabled and protected by an immediate lock during send; Gmail sends are never automatically retried. On uncertain provider errors, check Gmail Sent before retrying.

## Required before deployment

1. `scripts/crm-consolidation/13-gmail-conversations.sql` has been applied in the consolidated staging and production databases; see release operations above. Do not rerun the historical Gmail outreach migration.
2. Enable/approve the additional `https://www.googleapis.com/auth/gmail.send` Google OAuth scope and review the consent configuration. Reconnect each mailbox to grant sending permission. Existing capture behavior continues using read-only access.
3. Provide the app's existing Supabase, Gmail OAuth and token-encryption configuration. Tokens remain encrypted with the existing key. Do not change database aliases or move data to the retired CRM project.
4. Validate with an authenticated staging account: inbound/outbound history, member-private mailbox visibility, permission denial, new email, reply threading, To/Cc/Bcc, read-only reconnect, ambiguous address matches, SMS opt-out behavior and bulk campaign confirmation.
5. Email lead-note capture continues through the existing scheduled sent-email worker, not a second immediate status update path. Its matching/capture limitations remain unchanged.

## Limitations and validation

- Drafts remain tab-memory only; refreshing/leaving removes them. Browser Back remains unguarded as in the approved prototype.
- Personal SMS conversations use the same 30/70 desktop split as email: message history and the compact reply box together on the left, and only the smartphone preview on the right. The phone stays 240 × 520px, matching the existing campaign preview dimensions; long drafts scroll inside it without resizing the device. On narrow screens only the conversation/reply column is shown. Bulk campaign composition remains separate.
- The verified staging database enables email composition with a simulated sender, without Gmail setup. Preview sends never call Gmail or clear the draft; production deployments and production databases cannot enable this preview. Production sending still requires a connected mailbox and send permission.
- Lead, contact, staff and conversation list names share `PersonName` / `PersonNameButton`: bold, 16px, no underline. New-message channel choices use the shared `Button`; email's empty-state action lives in the reader panel.
- Mailboxes are private to the membership that connected them; shared-team mailbox delegation is not implemented.
- Directory lookup uses primary contact/lead email/phone. Family/account-holder alternative routes need separate verification; no fuzzy email/profile matching is performed.
- Incoming email is fetched live per selected contact, not persisted into a new email database. Shared email addresses can surface the same provider thread for multiple contacts; the app does not guess which lead uniquely owns it.
- Local suite: 313 tests passed, including eight new Gmail MIME/API authorization/provider tests with synthetic data; TypeScript and targeted ESLint passed.
- Browser runner `scripts/security/conversations-live-browser.cjs` uses a standalone Next harness and intercepted API responses, at 1440px and 390px. It verifies personal SMS history/drafts, existing contact/lead panels, email history, sender mailbox, failed-email draft retention and overflow. This is not authenticated/provider integration validation. Screenshots: `/tmp/pulse-live-conversations-{1440,390}.png`.
- The earlier local build lacked Supabase configuration. The hosted production build is the release gate and verifies production database aliases, OAuth origin, encryption and scheduler configuration without logging secret values.
- No real messages were sent and no commit was created. Gmail reconnection/consent and authenticated provider integration remain operator follow-up tasks after deployment.