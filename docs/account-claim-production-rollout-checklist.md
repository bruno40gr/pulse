# Account Claim Production Rollout Checklist

Status date: September 27, 2026

This checklist is for the operational rollout of unified staff login and account claiming. It does not authorize a shared-code cutoff, real staff invitations, or migration activation. Never commit provider credentials, SMTP passwords, Supabase service-role keys, recovery links, or staff passwords.

## 1. Current release gate

- [x] Migration 015 is applied in the target Supabase project.
- [x] `npm run verify:account-foundation` passes.
- [x] `npm run verify:account-management` passes and removes its mutable fixtures.
- [x] `npm run verify:account-claim` passes and removes its people/Auth fixtures.
- [x] No `pulse-claim-*` people or Supabase Auth users remain.
- [x] TypeScript passes with `npx tsc --noEmit`.
- [x] Targeted account-release ESLint passes.
- [x] `npm run build` passes.
- [x] `migration_enabled` is `false`.
- [x] `transition_starts_at` is unset.
- [x] `legacy_access_ends_at` is unset.
- [x] No real staff invitations have been sent during verification.
- [ ] Alex Bird has a verified staff email. Do not invite him before both the email is verified and his October 5, 2026 eligibility date.

## 2. SMTP provider and DNS

Recommended sender isolation: use a dedicated authentication subdomain such as `auth.headlinerma.com` rather than the organizational root domain.

- [ ] Create or select the production transactional-email provider account.
- [ ] Add the authentication subdomain in the provider dashboard.
- [ ] Add the provider-supplied SPF record to DNS.
- [ ] Add all provider-supplied DKIM records to DNS.
- [ ] Add or confirm an appropriate DMARC policy and reporting destination.
- [ ] Wait for the provider to report the domain as verified.
- [ ] Choose a recognizable From name and address for staff account mail.
- [ ] Store SMTP host, port, username, and password only in the Supabase dashboard or approved secret manager.
- [ ] Confirm the SMTP credential is production-specific and can be rotated independently.

Do not paste credentials into chat, source files, commits, screenshots, issue trackers, or this checklist.

## 3. Supabase authentication configuration

- [ ] Set the production Site URL to the canonical production Pulse origin.
- [ ] Add the exact production claim callback URL to the redirect allowlist.
- [ ] Add the exact production password-recovery callback URL to the redirect allowlist.
- [ ] Keep redirects HTTPS-only in production.
- [ ] Remove obsolete preview or temporary redirect URLs that are not still required.
- [ ] Configure custom SMTP using the verified provider credentials.
- [ ] Review invitation and recovery email templates for correct product name, sender identity, and destination links.
- [ ] In the **Invite user** template, replace the direct `{{ .ConfirmationURL }}` button target with:

  ```html
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&redirect_to={{ .RedirectTo }}
  ```

- [ ] In the **Reset password** template, replace the direct `{{ .ConfirmationURL }}` button target with:

  ```html
  {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&redirect_to={{ .RedirectTo }}
  ```

- [ ] Confirm that opening either template link with `GET` shows Odeon's confirmation page without creating a Supabase session; token redemption must occur only after the user presses the Continue button.
- [ ] Confirm email-verification policy still matches the approved rollout decision; do not change it incidentally while configuring SMTP.
- [ ] Confirm provider and Supabase rate limits are sufficient for the controlled test and expected rollout batch.

Record the exact approved URLs in the private deployment record, not in public documentation if they reveal non-public infrastructure.

## 4. Production application environment

- [ ] Set `PULSE_APP_URL` to the canonical HTTPS production origin, with no unintended path or trailing whitespace.
- [ ] Confirm the existing Supabase URL and public anon key point to the intended production project.
- [ ] Confirm the service-role key is available only to the server runtime.
- [ ] Confirm the shared system code remains stored only as a secret.
- [ ] Leave `PULSE_ACCOUNT_CLAIM_DEADLINE_DISPLAY` unset unless rollout copy has an approved deadline. This variable is display-only and does not enforce a cutoff.
- [ ] Verify preview environments cannot send production staff invitations unintentionally.

## 5. Controlled email-delivery test

Use a designated internal test membership and mailbox. Do not use a real staff member who has not approved participation, and do not change rollout controls.

- [ ] Send the first setup invitation from Access & roles.
- [ ] Confirm the message reaches the intended inbox rather than spam.
- [ ] Inspect From, Reply-To, subject, branding, and link host.
- [ ] Confirm the setup link opens the production claim page and no secret token appears in application logs.
- [ ] Set a compliant password and finish claiming.
- [ ] Confirm the claimed membership becomes active and is linked to the same existing person/membership.
- [ ] Confirm the claimed account can sign in with its personal password.
- [ ] Confirm the selected staff identity must match the authenticated membership.
- [ ] Confirm the same person can no longer use the shared code after claiming.
- [ ] Confirm another still-unclaimed test membership can continue using the shared code.
- [ ] Trigger Resend before claiming and confirm the new message is delivered correctly.
- [ ] Trigger password recovery after claiming and confirm the recovery link and reset flow work.
- [ ] Confirm recovery is rejected for an unclaimed, suspended, or deactivated membership.
- [ ] Confirm relevant invitation, activation, and recovery audit events exist and contain no credentials or raw recovery tokens.
- [ ] Remove or clearly document all controlled-test records according to the approved retention policy.

## 6. Pre-deployment review

- [ ] Review the complete Git diff, including untracked migration, route, component, library, verification, and documentation files.
- [ ] Confirm no `.env*`, credentials, provider tokens, private keys, generated build output, or fixture passwords are tracked.
- [ ] Confirm deleted seed/migration API routes are intentional and no operational process still depends on them.
- [ ] Re-run `git diff --check`.
- [ ] Re-run the foundation, account-management, and account-claim verifiers against the intended target.
- [ ] Run `npm run verify:scanner-safe-auth` and confirm invite/recovery links survive scanner-style `GET` requests, redeem once on `POST`, reject replay, and block external redirects.
- [ ] Re-run TypeScript, targeted lint, and the production build.
- [ ] Review the known broad-lint debt separately; do not misrepresent it as introduced by the account release.
- [ ] Create a reviewed commit with the SQL migrations, runtime changes, verification scripts, and documentation together.

## 7. Deployment and smoke test

- [ ] Deploy without changing account rollout settings.
- [ ] Confirm the deployment uses the expected production environment variables.
- [ ] Smoke-test one unclaimed test account with the shared code.
- [ ] Smoke-test one claimed test account with its personal password.
- [ ] Confirm a wrong name/password combination is rejected without revealing private staff data.
- [ ] Confirm suspended and deactivated memberships are absent from the public login list.
- [ ] Confirm dashboard claim reminders show only a masked email and can be dismissed for the session.
- [ ] Confirm logout clears both the Supabase session and legacy/reminder state.
- [ ] Confirm Access & roles is limited to exact Owner/Admin roles and Owner assignment remains Owner-only.
- [ ] Confirm ordinary dashboard and API operations still resolve the correct tenant and permissions.
- [ ] Monitor application, Supabase Auth, and email-provider logs during the test window without recording secrets.

## 8. Separate rollout decision — do not perform implicitly

Only after delivery tests, deployment smoke tests, and stakeholder review:

- [ ] Approve the staff communication and support plan.
- [ ] Obtain and verify Alex Bird's email when appropriate.
- [ ] Select an exact transition start timestamp.
- [ ] Select an exact legacy-access cutoff timestamp.
- [ ] Decide whether and when to set `migration_enabled = true`.
- [ ] Schedule invitation batches and support coverage.
- [ ] Define rollback criteria and the authorized operator.

Until that separate decision is approved, keep `migration_enabled = false`, `transition_starts_at = null`, and `legacy_access_ends_at = null`.