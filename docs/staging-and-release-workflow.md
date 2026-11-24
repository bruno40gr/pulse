# Staging and release workflow

## Decision — November 23, 2026 (Pacific)

Agreed with Bruno: **persistent staging is not a required gate for everyday
development or releases.** Do not rebuild or populate it merely to satisfy a
Preview checklist. Staging is an optional, purpose-specific safety tool, not a
second product or a substitute for the real school's workflows.

This supersedes blanket hosted-staging/manual-Preview requirements in older
release notes and handoffs. It does **not** waive authorization, tenant isolation,
database compatibility, recovery, or change-specific safety checks. Historical
staging findings remain historical evidence, not a production baseline.

## Why this changed

The integrated Staff/subscription Preview had different authentication, missing
migrations, no subscription rows, and an empty scheduling directory despite an
existing operational Staff directory. It imposed testing work on the user without
establishing whether the release would work with the real school.

Synthetic fixtures remain useful for automated regression coverage. They are not
user acceptance, proof of production compatibility, or a reason to ask Bruno to
debug a fictional school. Missing fixtures mean **not tested**, never passed.

## Default workflow

1. Use the existing active release line. No micro branches or duplicate product
   directories. Follow `docs/branch-and-worktree-rules.md`.
2. Review the actual change and run local type/regression/browser checks. Report
   what each check proves and does not prove. The agent owns technical validation.
3. Where real relationships or installed schema matter, verify production through
   an **enforced read-only** connection. Prefer aggregate/minimal queries; never
   copy identities, credentials, or customer records into a test environment.
   Promising not to write with a service-role key is not enforced read-only access.
4. Prepare a bounded release: exact commits, configuration/schema prerequisites,
   known limitations, application rollback, and migration-specific backup/recovery
   where applicable. Keep unfinished paths unavailable rather than exposing broken
   functionality. Commit/push is not release acceptance.
5. Obtain explicit approval before merging/promoting to production, changing
   production configuration, applying migrations, or running production write
   tests. Approval to continue development is not production-change approval.
6. After approved deployment, verify read-only behavior first. Any write test needs
   approved record/action scope, expected results and cleanup/recovery. No casual
   customer messaging, payments or destructive smoke tests. Give Bruno one concise
   handoff, not a debugging checklist.

## When an isolated rehearsal is warranted

Use a disposable local database or a deliberately scoped environment for database
migrations, permissions/authentication, destructive imports, billing, or other
high-risk changes. State the question first—for example, “Does this upgrade
preserve existing subscriptions and reject stale writes?”

Rehearse representative structure/data relationships, failure atomicity,
permissions and rollback. Synthetic data proves only those specific properties;
production read-only checks establish actual compatibility. If a rehearsal cannot
answer its question, fix the validation design rather than expanding an
unrepresentative permanent staging installation.

## Preview and staging boundaries

- A Preview is a code deployment; staging is its data/configuration environment.
- Never connect unfinished Preview code to production with write-capable keys.
- A branch push may trigger existing Preview automation. That does not make
  Preview review mandatory or authorize changing hosting settings.
- Do not delete staging infrastructure, retire credentials or change deployment
  automation under this decision without separately reviewed authorization.
- No standing staging refresh, fake-data population or manual Preview acceptance
  is required for the current Staff/subscription release.

## Current release

Use `docs/integrated-release-checkpoint-20261123.md` for evidence and remaining
gates. This decision changes the workflow; it does not declare the release ready
or authorize production promotion.