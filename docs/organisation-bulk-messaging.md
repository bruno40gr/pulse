# Contacts bulk messaging

## Deployment

1. Apply `/Users/brunowong/pulse/scripts/migration-026-organisation-email.sql` in the **CRM** database that contains `gmail_connections`. This is additive; it does not promote existing personal connections into organisation senders. It creates owner-managed settings and service-role-only delivery tracking.
2. Ensure Student Accounts Migration 001 is present in the primary contacts database. Routing deliberately fails closed if the complete account-holder relationships cannot be read; it must never fall back to the minor’s address.
3. The account owner connects the shared Google Workspace mailbox in Settings → Gmail, then selects it in Organisation email. Existing Gmail readonly + send consent supports reading verified send-as aliases; no new Google OAuth scope is requested.
4. Verify same-domain aliases in the shared mailbox’s Google send-as settings. Assign each alias to an account member, set its sender name and optional signature, and save. Domain membership alone does not grant sending permission.
5. Verify the shared sender/alias using test contacts before enabling staff workflows. No real email or SMS is sent by the automated tests.

## Policy

- Contacts and Conversations share the same page-header **Send new text message** and **Send new email** actions, built from the shared Button component. Contacts enables them after selection. There is no recipient-routing selector.
- Multiple selected Contacts open a short confirmation modal for either channel, without repeating the contact list or selected count. Continue navigates in the same tab to `/dashboard/inbox/bulk`, inside the Conversations workspace, never an overlay or side drawer. The URL contains an opaque session selection key, not contact IDs. Missing, malformed, or wrong-account selections fail closed. Single-contact profile composition retains its contextual drawer. Shared modal headings default to 18px and never contain a subtitle; explanations belong in the body.
- Both channels show an expandable yellow “Excluded from sending” notice with excluded names and reasons. Email places it below blocking errors, outside the To field. From is always a dropdown labelled with the configured organisation name and email, or Me plus the authorised member name and email. No placeholder organisation identity is offered.
- Minors route to every account holder recorded in `student_accounts` and the legacy primary account. Their own destination is never a fallback.
- Adults use their saved account-holder preference, otherwise their own details.
- Destinations are normalised and deduplicated. Existing opt-outs suppress shared destinations, including an unselected opted-out sibling.
- Preview and send share the resolver. A version mismatch stops delivery and requires a fresh review.
- Bulk email uses one To recipient per provider request and no CC/BCC. Student-specific placeholders must be replaced with neutral text; no arbitrary child is selected for a shared family destination.
- Organisation senders require communications-send permission. “Me” appears only for a member explicitly assigned a Google-verified same-domain alias. Sharing a domain alone never authorises sending. The From dropdown remains visible even with one available identity; no configured identity displays a disabled setup prompt.
- Both email API entry points enforce the organisation sender gate. Existing personal connections remain readable only by their connector, never usable for sending. Shared-mailbox history is available to members with communications-read permission.
- Missing Migration 026 does not prevent reading an existing private mailbox; it still blocks all organisation sends. Missing Student Accounts Migration 001 blocks recipient verification with a setup message rather than falling back to incomplete routing. Recipient and sender setup errors are displayed independently.
- SMS configuration and sender identity are unchanged.

## Delivery safety

Bulk email is sent in bounded server batches with an operation ID and a unique record per destination. Repeating an operation skips sent, failed, and uncertain attempts. Timeout/5xx outcomes remain **unknown**, not successful and not automatically retried. Use the progress/continue action to send only unattempted destinations; check uncertain deliveries in the shared mailbox’s Sent folder first. A partially sent operation is immutable. Changing recipients, identity, or content requires a new operation and a deliberate review to avoid duplicates.

Drafts and operation progress are stored in the current browser’s session storage and scoped to tenant and contact selection. They are not cross-device/server-saved drafts. Gmail acceptance is not proof of final inbox delivery.

## Validation

- `node --test scripts/security/*.test.cjs`
- `npx tsc --noEmit`
- `npm run build`
- `PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/security/bulk-communications-browser.cjs`

The browser check expects an isolated page rendering the real Contacts component at `BULK_REVIEW_URL` (default `http://127.0.0.1:3111/bulk`). All APIs are intercepted with synthetic fixtures. It checks desktop/tablet/mobile recipient counts, sender selection, draft restoration, SMS preview versions, and overflow.