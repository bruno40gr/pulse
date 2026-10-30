# Fictional enrollment rehearsal

**Date:** October 26, 2026\
**Status:** Runnable pure-helper composition example, not database/API/UI acceptance.

## What this demonstrates

One fictional student has piano and voice enrollments, each with a separate subscription ID. The script matches those identities, requires an explicit lesson selection and proposes a piano rate change from USD 50 to USD 55 per visit effective November 1, 2026. The illustrative in-memory history ends the prior rate on that date and leaves voice unchanged. These are fixed fictional dates, not instructions to change a real rate.

Nine asserted checks cover separate subscription matching, repeatable preview output, a third subscription remaining only a creation candidate, whole-input duplicate quarantine, ambiguous-selection rejection, non-mutating change proposals, preserved prior pricing/unselected enrollment, stale revision rejection and context mismatch rejection.

## Run it

From `/Users/brunowong/pulse`:

```sh
npm run rehearse:academy
npm run test:academy
```

The first command prints nine PASS lines and the fictional term histories. Any failed assertion exits unsuccessfully. The second runs the academy suites and existing tenant-selection regressions. No application server is required.

Implementation: `/Users/brunowong/pulse/scripts/academy/rehearse.cjs`. Tests: `/Users/brunowong/pulse/scripts/academy/rehearsal.test.cjs`. The loader reads only the allowlisted pure TypeScript helper files and supplies no application clients, process environment or network functions to their VM contexts. This is a controlled test harness, not a security sandbox for untrusted code. Fixture state is recreated each run and discarded; nothing is saved to a database or file.

## What remains unproven

The illustrative history projection is not a general persistence implementation. Deterministic preview is not persisted import idempotency. Rejecting a stale version in memory is not database concurrency control. Supplied scope is not authorization. No routes, UI, migrations, database constraints, RLS, recovery, callbacks, provider denial or billing calculations are exercised by this rehearsal. Existing tenant-selection tests provide their own narrower regression evidence, not full M1 authorization acceptance.

Next integration remains gated by `/Users/brunowong/pulse/docs/odeon-m1-integration-spec.md`: verify the approved schema/source contract and baseline/scenario model, then rehearse exact migrations and transactional commands in an isolated synthetic database. This example does not approve live-data access or cutover.

## Validation

Both commands executed successfully. Combined suites: **133 passed**, zero failed/skipped. The three new runner tests cover the combined nine-check journey, deterministic independent runs, and CLI execution with an empty environment configuration. TypeScript, targeted academy ESLint and `git diff --check` passed. No framework APIs were changed.

## Local disposable PostgreSQL availability

After Docker Desktop was started, an explicit local Unix-socket check reached Docker Engine 29.8.1 and found a cached `postgres:17` image. A one-off environment preflight used that cached image ID with pulling disabled, networking set to `none`, no published ports, no host-data mounts and a 256 MiB tmpfs database directory. Container configuration was inspected before startup.

The preflight created only a fictional table/record, verified a successful write, explicit transaction rollback, and rollback after a deliberately failing constraint check. The original value and row count remained unchanged after the failed transaction. Cleanup removed the container and verified its absence; tmpfs database contents were discarded. No application migrations, environment files, hosted connections or private exports were used.

**Result:** local disposable PostgreSQL is available while Docker Desktop is running. This proves environment availability and basic PostgreSQL rollback behavior only—not application transaction design, recovery, constraints, RLS, concurrent writes or any complete M1 acceptance case. The approved hosted schema and baseline/scenario architecture remain unresolved prerequisites for an exact application migration rehearsal.