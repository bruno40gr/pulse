# Integration plumbing: validation and rollout gates

## Scope and local evidence — November 20, 2026

- Contact safety reads authorize tenant/contact/note access, query canonical
  tenant-filtered `people` rows and return private, no-store responses. The
  production schema check found `notes_history`, `student_notes_history`, and
  `opted_out`, not a `notes` column. The safety endpoint scans internal
  `notes_history`; student-facing history is not substituted for internal notes.
- Contact insights are no longer persisted in browser storage in either panel.
  Responses from disposed effects cannot update the next panel. The retired
  `pulse_contact_insights_*` keys are removed on identity-provider mount, tenant
  selection and logout; unrelated storage remains untouched. This cannot erase
  keys on a device until it runs the updated application.
- Shared CC/BCC sends reserve `(tenant_id, operation_id)` before calling Gmail.
  Reservations start `uncertain`; successful confirmation records `sent`.
  Confirmed replays do not send again. Uncertain operations never retry
  automatically, including provider errors and lost confirmations. The composer
  locks after an attempted send. A newly created operation can still deliver a
  duplicate intentionally: this is operation-level protection, not semantic
  duplicate detection or a claim of exactly-once provider delivery.
- The fingerprint covers stable logical fields (mailbox, sender, recipient
  groups, subject, text and HTML), not the generated MIME boundary. Changed
  content or a different actor cannot reuse an existing reservation.
- Unread counts filter inbound, unread/null-status messages before transfer,
  preserve phone normalization, and paginate in ordered 500-row pages. Offset
  pagination is not a transactional snapshot during concurrent mailbox changes;
  exact, point-in-time counts would require a server aggregate/snapshot design.
- Notes authorization is resolved once per request. Band reads remain enabled
  by default; writes require an explicit enable flag and either explicit disable
  wins.

Validation performed locally:

| Check | Result |
| --- | --- |
| `npm run check:integration` | TypeScript passed; 1,078 tests passed, none failed |
| Targeted ESLint across changed TS/TSX/CJS files | Passed with 0 errors and 16 warnings; not a whole-repository lint claim |
| `npm run check:plumbing-db` | Disposable PostgreSQL 17 checks passed |

The database check uses the local `postgres:17` Docker image, no host ports,
volumes, production credentials or container networking. It creates a minimal
schema with deliberately non-unique membership IDs and exercises both migrations
and their reapplication, three simultaneous reservations, tenant-specific
uniqueness, uncertain/sent states, client ACL denial, service-role retention,
status/fingerprint constraints, null unread statuses and index-plan selection.
It does not replace verification of the production schema, PostgREST behavior,
Gmail delivery, or browser workflows.

## Database approval required before shared-email rollout

Do not apply these migrations to production or change hosting configuration
without approved rollout:

1. Confirm the actual CRM database used by `crmSupabaseAdmin`, its `tenants(id)`
   key, UUID actor IDs, and the `anon`, `authenticated`, `service_role` roles.
   Confirm the messages database used by `supabaseAdmin` and its column types.
   These clients need not target the same database; deploy each migration to its
   corresponding database rather than assuming one migration runner covers both.
2. Review and apply
   `supabase/migrations/202611200005_group_email_operations.sql` in the CRM
   database **before enabling shared sends**. The historical membership ID is
   intentionally not an FK: the earlier production prerequisite check did not
   establish a usable unique membership key. Server authorization owns actor
   validation. Deleting a membership must not erase send protection. Do not add
   cascading actor deletion, TTL cleanup or automatic uncertain-operation retry.
3. Verify the table definition and ACLs even if a same-named table already exists;
   `CREATE TABLE IF NOT EXISTS` does not reconcile an incompatible existing table.
   Test a service-role reservation/read/confirmation in staging and ensure
   anonymous/authenticated clients cannot read or mutate the ledger.
4. Review and apply
   `supabase/migrations/202611200006_unread_messages_index.sql` to the messages
   database in an approved maintenance window. It is a normal, non-concurrent
   index build, which can block writes. Review volume, locks and deployment
   transaction behavior before choosing a production execution strategy.
5. Missing/inaccessible ledger means shared email fails closed before Gmail;
   it is not an optional performance optimization. Keep reservations across
   rollback. Never drop the table or clear uncertain rows merely to restore sends.

## Other rollout gates remain closed

- `ENABLE_CONTACT_BAND_OPPORTUNITIES=true` or the corresponding
  `NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES=true` explicitly enables band
  writes; `false` on either disables them. Public flags are build-time client
  inputs, so align server and client configuration and rebuild when needed.
  Keep writes disabled until the relevant migrations and permissions are verified.
- Production checks found `band_profiles.coach_person_id` and `notes.band_name`
  missing. Review `202611210001_band_coach.sql` and
  `202611210002_band_notes.sql` before enabling those paths; future-dated filenames
  are not evidence of deployment. Academy workspace prerequisites also remain
  unverified. These fixes do not declare those workflows production-ready.

## Browser/staging acceptance still required

- With delayed requests, contact panels and composers must show the shared
  skeleton rather than empty/setup/partially hydrated content.
- Switch contacts and accounts while insights/safety requests are in flight;
  verify that prior responses and retired storage never surface in the new scope.
  Confirm logout/login with another user and a storage-blocked browser works.
- As owner, restricted staff, portal user and another-tenant user, verify contact
  safety, Notes and shared-mailbox permission boundaries.
- Send a fictional staging To/CC/BCC message, replay the same operation, race
  attempts, and simulate a lost response/confirmation. Verify one provider send,
  locked uncertain UI, and no automatic retry. Inspect BCC privacy in the mailbox.
- Exercise unread counts beyond 500/1,000 messages, including null statuses,
  invalid phones and campaign filters. Verify the production query plan.
- With band flags unset, verify read-only access and rejected writes. Verify
  explicit enable and explicit-disable precedence only in migrated staging.

No production migrations, live Gmail sends, hosting changes, or authenticated
browser acceptance were performed by the local validation described here.