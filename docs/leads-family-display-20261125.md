# Leads counts and saved family display — November 25, 2026

Base: `91eb60e`. Local implementation only; no hosted database writes,
migrations, deployment, commit or push performed for this follow-up.

## Contracts

- Left navigation: distinct saved CRM contact identities, net-new/uncontacted
  **and** younger than 48 hours. Exact expiry is excluded, as are future dates,
  existing-student opportunities and winback imports. Repeat submissions do not
  restart the person's window. Outbound SMS/call and persisted contact-status
  history suppress notifications even after reopening an intake as New.
- Lessons/Services tab totals include current-student opportunities. Neutral total
  badges remain separate from red net-new notification badges on desktop/mobile.
- Display families use saved primary student accounts, additional student-account
  memberships and explicit family links. Never surname/email/phone inference.
  Aguilar, Abutin and Berns relationship fixtures cover the reported topology.
- Display projections never write account, payer, permission or routing fields.
  Reminder account resolution remains based on explicit persisted family links,
  not inferred connected display groups.
- Holder dialog removes the two requested notices and redundant current-account
  label. Existing linked accounts appear as co-holders, including when new-link
  storage is unavailable. Disabled options retain their actual explanatory detail.

## Validation

- Focused tests: **54/54**.
- TypeScript: passed.
- Changed-file ESLint: **0 errors, 36 existing warnings** (Leads route/view).
- Full security suite: **1,123/1,140**, the same **17** baseline failures;
  failure names compared against the prior saved full-suite log.
- Synthetic loopback browser checks: **1440px and 390px**, tab total/new badges,
  holder linking with supported storage, existing co-holder display without new
  link storage, removed notices, account reminder save/complete.
- `git diff --check`: passed.

## Rollout limitations

These checks do not establish the served production version. Existing saved
student/account relationships require no new migration for display. Genuinely
new account-to-account links still require the primary database family-account
migration; account-owned reminder storage requires its CRM migration. Neither
was applied remotely. Existing person-link workflows remain available subject
to their existing deployed account-manager RPC. No permission/routing rollout
is implied by the presentation change.

Notification deduplication uses saved CRM contact IDs, not guessed identity from
names or shared destinations. Missing contact IDs fall back to intake IDs.
History checks use persisted CRM lead events/status, not a provider mailbox scan.