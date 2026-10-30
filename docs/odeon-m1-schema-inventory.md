# M1 — Schema inventory handoff

**Date:** October 26, 2026\
**Status:** Read-only metadata query tested locally; intended hosted schema remains unverified.

## Purpose and boundary

`/Users/brunowong/pulse/scripts/academy/schema-inventory.sql` provides an initial structural inventory for the M1 compatibility review. It does not create or migrate anything and does not select application records or migration-history records. It runs in a repeatable-read, read-only transaction with statement/lock timeouts and ends with rollback.

It reports relations, columns/types/nullability, presence of defaults, constraints and FK columns/targets, index flags, RLS enablement and policy metadata, trigger/function identities and visible table grants. Scope is explicitly `public` and `supabase_migrations`; public function metadata is included. Other application schemas must be identified and separately reviewed, not assumed absent.

For privacy, it omits default expressions, check/exclusion expressions, index expressions/predicates, policy expressions, trigger arguments, view SQL, function bodies and executable definitions. This means it is **not a schema dump** and cannot alone justify exact migration SQL or certify authorization. Object identifiers, type names, role names and server version may still be sensitive; metadata is not guaranteed anonymous.

## Local validation command

From `/Users/brunowong/pulse`, with Docker Desktop running and `postgres:17` already cached:

```sh
npm run rehearse:academy-schema
```

The runner at `/Users/brunowong/pulse/scripts/academy/schema-inventory-rehearsal.cjs` uses only a standard local Docker Unix socket, resolves the cached image to its ID and forbids pulling. It creates a uniquely named container with networking disabled, no published ports, no host-data mounts and a tmpfs database directory. It never loads application environment files or connects to Supabase. Cleanup removes the container and verifies its absence. Stop if cleanup fails; do not assume the environment was restored.

Synthetic tests check all eight metadata categories, FK column mapping, read-only mode, unchanged records, deterministic repeated output and execution under a restricted role. Sentinel literals in application rows, defaults, policy expressions, function bodies and migration statements must not appear in the output. An attempted write in a read-only transaction must fail.

## Approved-target handoff — not executed here

1. Obtain explicit approval for the intended project/environment and a read-only metadata session. Do not infer approval from a linked project file or configured service key.
2. Have the database administrator review the query and its schema scope before execution. Use an approved database SQL client; no credentials or connection strings belong in chat or Git. This repository adds no hosted runner.
3. Run the query in a dedicated session outside any existing write transaction. With psql, use `-X -qAt` and `ON_ERROR_STOP=1`; the single SELECT produces JSON. Do not paste an unreviewed data dump in place of this inventory.
4. Keep results in the approved private evidence location outside the repository. Review identifiers before sharing. Record target label, capture time, executing role's visibility and PostgreSQL version separately without secrets. Success on a fictional local schema says nothing about the hosted target.
5. Review missing evidence below before drafting exact additive migration/backfill SQL.

## Evidence still required

- Reviewed definitions for relevant defaults, checks/exclusion constraints, indexes/predicates, views, triggers/functions and RLS expressions. Review embedded literals privately; do not auto-export all executable source into Git.
- Complete schema/routine/column/sequence privileges, owners, role memberships, browser and service-role behavior. Visible table grants and RLS flags are not a full access audit.
- Applied migration versions and reconciliation with repository SQL. This query exposes migration-table structure only, not its rows or statement contents. An administrator must provide reviewed version identifiers separately.
- Actual instructor FK choice, enrollment eligibility and column/custom-field authority; verified CRM/funding/account/access dependencies.
- Approved baseline/scenario identity and refresh/rebase/recovery model, source-ID/export contract and isolated application migration plan.

## Validation record

`npm run rehearse:academy-schema` passed against disposable local PostgreSQL 17; cleanup passed. `npm run test:academy` remained **133 passed**, zero failed/skipped. Targeted academy ESLint, TypeScript and `git diff --check` passed. No hosted metadata was collected, no application migration ran, and no complete M1 database/authorization acceptance case is certified.