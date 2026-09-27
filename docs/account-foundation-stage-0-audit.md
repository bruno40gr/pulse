# Account Foundation — Stage 0 Audit

**Platform:** ODEON
**Repository:** `/Users/brunowong/pulse`
**Audit date:** September 26, 2026
**Status:** Technical audit complete; account foundation and manual account administration implemented

This document records the current authentication and authorization state before the first account migration. It is the implementation bridge between `odeon.md` and the Stage 1 schema work.

No authentication behavior or database schema was changed during this audit.

---

## 1. Executive Summary

ODEON does not currently have individual staff authentication or permissions.

The live access model is:

1. A user selects one of 16 hard-coded active teacher identities.
2. Everyone enters the same shared code.
3. The server writes a signed `pulse_access` cookie containing the selected teacher's IDs and display name.
4. Middleware treats possession of that cookie as sufficient access to almost every dashboard page and API route.
5. Most server routes use the Supabase service-role client, so database row-level security is not the effective authorization boundary.

Supabase Auth infrastructure exists, but it is not connected to dashboard access, staff identity, tenant membership, or route authorization. There are two Auth users in the primary Supabase project, but neither matches an active staff email.

The first migration should introduce memberships, roles, transition configuration, and audit events without removing the shared-code flow. Server identity and permission helpers should follow before personal accounts are exposed broadly.

---

## 2. Current Access Flow

### Login

Relevant files:

- `app/login/page.tsx`
- `app/api/access/teachers/route.ts`
- `app/api/access/login/route.ts`
- `lib/teachers.ts`
- `lib/access.ts`

The login page fetches the teacher list from `/api/access/teachers`, asks the user to select a name, and submits that instructor ID with the shared password to `/api/access/login`.

The login route:

- compares the submitted password with `PULSE_SYSTEM_PASSWORD`
- falls back to the literal value `1478` if the environment variable is missing
- verifies that the selected identity is returned by `getActiveTeachers()`
- creates a signed custom session cookie

The teacher list is not derived from every active instructor record. `lib/teachers.ts` contains an explicit `ACTIVE_TEACHERS` eligibility list and intersects it with live `instructors` and `people` rows. Entries may include a Headliner-local start date; Alex Bird is scheduled to become eligible on October 5, 2026.

### Session

`lib/access.ts` creates a custom HMAC-signed cookie named `pulse_access` with a 12-hour lifetime.

The cookie payload contains:

- `instructorId`
- `personId`
- `fullName`
- `displayName`
- an access scope of either Headliner or a specific demo tenant
- expiration timestamp

For Headliner sessions, the access scope is effectively unrestricted. `canAccessTenant()` returns `true` for every tenant when the scope is `headliner`.

The session secret falls back in this order:

1. `PULSE_SESSION_SECRET`
2. `PULSE_SYSTEM_PASSWORD`
3. the literal string `pulse-headliner-session-2026`

Production must require an explicit session secret during the transition. A built-in signing-secret fallback is not acceptable for the account foundation.

### Middleware

`middleware.ts` protects most pages and APIs by checking only for a valid `pulse_access` cookie.

Public paths currently include:

- `/login`
- `/demo`
- every `/api/access/*` route
- `/api/intake`
- `/api/twilio/webhook`

Middleware initializes a Supabase SSR client, but it never calls `supabase.auth.getUser()` or otherwise validates a Supabase Auth identity. Supabase Auth cookies therefore do not grant dashboard access, and dashboard access does not require Supabase Auth.

### Logout

`/api/access/logout` clears only the custom `pulse_access` cookie. It does not sign out a Supabase Auth session. The client then redirects to `/demo`.

The replacement logout path must clear both access systems during migration so a user cannot remain authenticated through the other session type.

---

## 3. Supabase Auth Status

Relevant files:

- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/supabase/admin.ts`
- `app/signup/page.tsx`

The repository has browser, server, and service-role Supabase clients. The only product code that currently invokes Supabase Auth is the public `/signup` page.

The signup page calls `supabase.auth.signUp({ email, password })` and redirects directly to `/dashboard`. That redirect does not create the required custom access cookie, so middleware sends the user back to `/login`. It also creates no tenant or staff relationship.

The public signup page should be disabled or redirected before the account rollout. Staff accounts must be created through a controlled claim or invitation flow, not unrestricted signup.

### Live Auth inventory

Privacy-safe inspection of the configured primary Supabase project found:

| Item | Count |
|---|---:|
| Supabase Auth users | 2 |
| Verified Auth users | 1 |
| Auth users matching an active staff email | 0 |

The existing Auth users must be reviewed before rollout. This audit did not expose their email addresses or modify them.

---

## 4. Live Staff Identity and Email Readiness

### Canonical records currently used by the application

The live application uses:

```text
people
  └── instructors
```

`people` contains names, phone numbers, email addresses, and custom fields. `instructors` links a tenant to a person and represents teaching capability.

An old migration and `/api/migrate` route describe a separate `staff` table, but the table is not exposed in the live schema and current staff APIs explicitly use `instructors`. The account foundation must not assume the historical `staff` migration represents deployed reality.

### Live Headliner inventory

Privacy-safe inspection found:

| Item | Count |
|---|---:|
| Headliner instructor records | 18 |
| Active instructor identities | 16 |
| Inactive/sunset instructor identities | 2 |
| Active instructors with an email | 3 |
| Active instructors missing email | 13 |
| Active instructors with an invalid non-empty email | 0 |
| Duplicate active email groups | 0 |

Email collection is therefore a rollout prerequisite. On September 26, 2026, addresses were supplied for 16 names. Drew Johnson (supplied as Andrew Johnson), Vitto Trinchese, and Mae Strider (supplied as Mae Adams) already had the supplied addresses. Migration 013 safely prepares 13 unambiguous assignments, including the later-supplied addresses for Lorena Rudha and Mel Solano-Rojas. Migration 014 prepares Mae as active staff and creates Alex Bird as scheduled staff for October 5, 2026. Alex is now the only planned staff identity still needing a verified email before personal account claiming.

### Identity decision for Stage 1

`tenant_memberships` should link to `people.id`, not require a `staff.id` or `instructors.id`.

Reasons:

- `people` is the live canonical person record.
- the proposed historical `staff` table is not part of the live application model
- not every future staff account must be an instructor
- a person may have an optional `instructors` record when they teach
- parent and student identities can later use the same person foundation without pretending they are instructors

The membership may expose an associated instructor through the shared `person_id`, but it should not duplicate or own teaching data.

---

## 5. Tenant Isolation and Authorization Audit

The repository currently contains 46 API route files.

| Route behavior | Route-file count |
|---|---:|
| Uses `resolveRequestTenant()` | 7 |
| Uses `assertTenantAccess()` | 3 |
| Reads the custom actor with `getRequestActor()` | 6 |
| Uses Supabase Auth in an API route | 0 |

These categories overlap. The remaining routes generally rely only on middleware possession of the custom cookie.

### Current tenant model

The browser stores an active tenant ID in `localStorage`. Many APIs accept `?tenant=<uuid>` and use that value directly with the service-role client.

For a Headliner access cookie, `canAccessTenant()` allows every tenant. The stricter tenant isolation logic applies only to demo sessions.

This means the current Headliner session is not a tenant membership. It is a broad application-access token.

### Service-role impact

Most data APIs use `supabaseAdmin`. The service-role key bypasses normal row-level policies, which makes application-layer authorization mandatory.

The account project must not assume that adding Auth users or database RLS alone secures these routes. Every protected route needs a server-resolved user, membership, tenant, and permission before performing service-role operations.

### Permission status

There are currently:

- no route permission checks
- no role assignments connected to access
- no capability catalog
- no owner/admin/teacher distinction in server authorization
- no account-state enforcement

The `role: 'instructor'` value returned by staff APIs is a display value, not an authorization role.

---

## 6. High-Risk Existing Endpoints

The following endpoints deserve early conversion because they mutate data, configuration, communications, or schema while relying primarily on the shared cookie.

### Destructive or administrative

- ~~`POST /api/migrate` — executes database DDL through the service role~~ Removed during Stage 2; schema changes use versioned SQL migrations.
- `POST /api/contacts/reset` — now requires `contacts.delete` and text confirmation.
- `POST /api/staff/backfill` — converted from GET and now requires a Headliner Owner, explicit confirmation, and an audit event.
- ~~`GET /api/staff/seed` — creates and assigns demo instructors through a GET request~~ Removed during Stage 2.
- ~~`GET /api/inbox/seed` — deletes and recreates fictional inbox messages across tenants~~ Removed during Stage 2.
- `GET`, `POST`, and `DELETE /api/twilio-config` — now require `communications.configure`; mutations write credential-safe audit events.
- `PUT /api/brand-settings` — now requires `tenant_settings.manage` and writes a content-safe audit event.
- `PUT /api/pulse-settings` — now requires `tenant_settings.manage` and writes a settings audit event.
- `POST /api/tenant-fields` — now requires `tenant_settings.manage`, validates accepted columns, and writes a count-only audit event.

Request-time creation of `tenant_settings` through `exec_sql` was removed. Migration 012 was applied on September 26, 2026. The table is queryable; Headliner currently has no row because brand and Pulse settings create it on first save.

### Communications and external effects

- `POST /api/campaigns/[id]/send` — now requires `communications.send` for real tenants, preserves signed demo simulation, scopes campaign and recipient lookups to the authorized tenant, and writes a content-safe aggregate audit event after a successful real send.
- `POST /api/inbox/reply` — now requires `communications.send` for real tenants, preserves signed demo simulation, writes an identifier-only audit event after a successful real reply, and surfaces failed HTTP responses to the inbox UI.
- `POST /api/calls` — now requires `communications.send` for real tenants, preserves signed demo simulation, resolves the caller from the authorized membership context, and writes an identifier-only audit event after a real call starts.
- The shared `authorizeCommunicationSend()` boundary prevents demo sessions from selecting Headliner or another demo tenant while supporting both legacy transition sessions and Supabase-authenticated memberships.

### Business-record mutations

- contact create, update, delete, and bulk import routes
- lead update, delete, and win-back import routes
- note create, update, delete, and reply routes

These routes should receive explicit capability requirements during Stage 2. Migration and reset endpoints should be owner-only or removed from ordinary production routing.

### Separate hard-coded credential

Bulk lead deletion previously checked a literal password inside `app/api/leads/route.ts`. Stage 2 removed that shared credential; the route now requires `leads.delete` and retains an explicit destructive confirmation flow in the UI.

---

## 7. Authorship and Auditability

Current collaborative records store mutable display text instead of stable identity references:

- `notes.created_by` is text
- `note_replies.created_by` is text
- lead event payloads embed actor IDs and a display name in JSON
- call metadata embeds the custom cookie actor

The recent server-derived reply author work prevents a client from inventing a reply name, but the stored value remains a string. Renaming a staff member will not update or reliably resolve historical authorship.

Stage 1 should add stable membership references to notes and replies while preserving existing text columns as historical display snapshots. Existing records can retain null membership IDs until a safe backfill is possible.

Audit events must be separate from user-facing notifications and ordinary activity timelines.

---

## 8. Live Schema Findings

The primary Supabase schema currently exposes `people` and `instructors` with these relevant columns:

```text
people
  id
  tenant_id
  first_name
  last_name
  phone
  email
  custom_fields
  created_at
  updated_at

instructors
  id
  tenant_id
  person_id
  specialty
  created_at
```

The following proposed account-foundation tables are not currently exposed in the live schema:

- `tenant_memberships`
- `roles`
- `permissions`
- `role_permissions`
- `audit_events`
- `notifications`

The historical `staff` and `tenant_settings` definitions in repository migration code are also not exposed in the live schema. Stage 1 must use a new versioned SQL migration rather than relying on `/api/migrate` or self-healing runtime DDL.

---

## 9. Stage 1 Schema Recommendation

Stage 1 should be additive and should not change the active login flow.

### 9.1 `tenant_memberships`

Purpose: connect a tenant person to an optional Supabase Auth identity and an authorization role.

Recommended fields:

```text
id uuid primary key
tenant_id uuid not null
person_id uuid not null
auth_user_id uuid null
role_id uuid not null
status text not null
legacy_access_enabled boolean not null default true
invited_at timestamptz null
activated_at timestamptz null
email_verified_at timestamptz null
suspended_at timestamptz null
deactivated_at timestamptz null
created_at timestamptz not null
updated_at timestamptz not null
```

Required constraints:

- unique `(tenant_id, person_id)`
- unique non-null `auth_user_id`
- foreign keys to `tenants`, `people`, `auth.users`, and `roles`
- membership person must belong to the same tenant; enforce with a composite foreign key or a guarded database function/trigger
- constrained status values: `unclaimed`, `invited`, `active`, `suspended`, and `deactivated`

For the migration period, an active instructor receives an `unclaimed` membership with `auth_user_id = null` and `legacy_access_enabled = true`. Sending an admin invitation changes the status to `invited`. Claiming fills `auth_user_id`; successful account setup changes the status to `active` and disables legacy access. Email verification is recorded when available but is not required for activation under the initial policy.

### 9.2 `permissions`

Purpose: catalog stable capability keys used by server code.

Recommended fields:

```text
id uuid primary key
key text unique not null
description text not null
created_at timestamptz not null
```

Permission keys may be seeded by migration because they are application contracts, not tenant content.

Initial groups should cover:

- accounts and roles
- staff
- contacts and families
- leads
- notes
- communications
- tenant settings
- audit history

Scheduling, billing, reporting, and portal permissions can be added when those domains exist.

### 9.3 `roles`

Purpose: assign a named permission bundle within a tenant.

Recommended fields:

```text
id uuid primary key
tenant_id uuid not null
key text not null
name text not null
description text null
is_system boolean not null default false
created_at timestamptz not null
updated_at timestamptz not null
```

Required constraint: unique `(tenant_id, key)`.

Initial Headliner roles should be seeded only after assignments and boundaries are confirmed. The working role set remains Owner, Admin, Operations, Teacher, and Read-only.

### 9.4 `role_permissions`

Purpose: map roles to capability keys.

Recommended fields:

```text
role_id uuid not null
permission_id uuid not null
created_at timestamptz not null
primary key (role_id, permission_id)
```

Per-user permission overrides are intentionally deferred. They can be added later if real exceptions appear.

### 9.5 `tenant_account_settings`

Purpose: hold the account migration window independently from brand and Pulse settings.

Recommended fields:

```text
tenant_id uuid primary key
migration_enabled boolean not null default false
transition_starts_at timestamptz null
legacy_access_ends_at timestamptz null
allow_emergency_legacy_override boolean not null default false
require_email_verification boolean not null default false
allow_admin_invitations boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

The 10-day window should be created by configuration, not encoded as database or application logic. The UI should display the configured cutoff timestamp.

### 9.6 `account_audit_events`

Purpose: immutable account and authorization history.

Recommended fields:

```text
id uuid primary key
tenant_id uuid not null
actor_membership_id uuid null
target_membership_id uuid null
event_type text not null
metadata jsonb not null default '{}'
created_at timestamptz not null
```

Do not include passwords, reset tokens, session cookies, service keys, or full credentials in metadata.

### 9.7 Notes and replies

Add nullable stable references:

```text
notes.created_by_membership_id uuid null
note_replies.created_by_membership_id uuid null
```

Keep the existing `created_by` text values as display snapshots and for legacy history.

### 9.8 Indexes and grants

Stage 1 should add indexes for tenant, person, Auth user, role, status, and audit-event timestamps. Grants and RLS should be explicit even though current APIs use the service role. Browser clients should not receive direct write access to membership, role, permission, or audit tables.

---

## 10. Stage 2 Server Contract

Before personal login is exposed, routes should converge on a server context similar to:

```ts
type RequestContext = {
  authUserId: string | null
  membershipId: string | null
  tenantId: string
  personId: string
  instructorId: string | null
  displayName: string
  permissions: Set<string>
  sessionKind: 'supabase' | 'legacy' | 'demo'
}
```

Recommended helper responsibilities:

```ts
requireAuthenticatedUser()
requireTenantMembership()
requirePermission(permissionKey)
resolveLegacyTransitionActor()
```

During migration, the request resolver may accept either:

- a valid Supabase Auth session with an active membership, or
- a valid legacy cookie whose person has an invited membership and remains eligible before cutoff

The two paths must resolve to the same membership-centered request context. Feature routes should not care which login method produced it.

Demo access should remain a separate explicit session kind with read/write limits decided independently from staff roles.

---

## 11. Route Conversion Order

Converting all APIs in one change would be risky. Recommended order:

1. Add the shared request-context and permission helpers with legacy compatibility.
2. Protect account, role, audit, migration, reset, seed, and tenant-settings endpoints.
3. Protect communication routes that send SMS, email, or calls.
4. Protect contact, lead, staff, and note mutations.
5. Convert read routes and remove direct trust in browser-selected tenant IDs.
6. Add automated coverage for tenant isolation and each role boundary.
7. Only then expose individual account claiming and primary Auth login.

Middleware should perform coarse session routing. Route helpers must remain the authoritative authorization layer.

---

## 12. Rollout Data Work

Before Stage 3 account claiming:

1. Apply `scripts/migration-013-headliner-staff-emails.sql` for the 13 reconciled missing addresses, then apply `scripts/migration-014-onboard-mae-and-schedule-alex.sql` to add Mae Strider immediately and schedule Alex Bird for October 5, 2026.
2. Review the two existing Supabase Auth users and decide whether to retain, link, or remove them.
3. Confirm that the 17 immediately eligible login identities map to the intended `people` rows and that Alex Bird remains hidden until October 5, 2026.
4. Confirm the two sunset instructors remain ineligible for self-claiming.
5. Verify the migrations assigned Owner to Bruno Wong and Lorena Rudha and Admin to every other planned staff member.
6. Select transition start and cutoff timestamps.
7. Confirm the account UI does not offer an emergency legacy override after cutoff.

The setup modal may collect a missing email during self-claim, but an administrative pre-rollout audit is still needed to prevent duplicates and accidental claims.

---

## 13. Initial Authorization and Rollout Decisions

Decisions confirmed September 26, 2026:

1. Bruno Wong and Lorena Rudha receive the initial Owner role.
2. Every other active staff member receives the Admin role for now.
3. Owner and Admin have identical capabilities initially.
4. Broad staff visibility remains in place; teachers may view all current contacts and notes.
5. No Operations, Teacher, or Read-only restrictions are introduced yet.
6. Roles and granular permissions should exist as editable configuration so access can be refined later without changing the account model.
7. Admins may initiate account invitations.
8. Email verification is not required before individual-account access.
9. Emergency legacy access after cutoff is not allowed.
10. Transition dates will be selected only after the account flow is complete and judged safe to roll out.

The account administration UX should make role assignment and future permission changes understandable without requiring technical knowledge. The initial experience should stay simple: account status, role, invitation action, and clear access-state messaging.

The **Access & roles** area is available only to memberships with the exact protected `owner` or `admin` role key. Either role may review staff account state, explicitly send or resend account setup email, and manually create an unclaimed account for an eligible existing staff person or create a new staff identity and unclaimed membership together. Email and phone remain optional during manual creation, and no Auth user or invitation is created until an Owner or Admin explicitly chooses Invite.

Role and permission administration is available only to the exact protected `owner` and `admin` role keys. Both can assign staff roles, create reusable roles, and edit capability mappings for non-Owner roles. Custom roles do not gain this administration surface through `roles.manage`. Admins still cannot assign the Owner role, and the final Owner cannot be reassigned.

Still unresolved before rollout activation:

- exact transition start and cutoff timestamps
- the disposition of the two existing unmatched Supabase Auth users
- a verified email address for Alex Bird

---

## 14. Acceptance Criteria for Stage 1

Stage 1 is complete when:

- a versioned additive SQL migration exists in `scripts/`
- the migration creates memberships, roles, permissions, role mappings, account settings, and account audit events
- memberships link to `people.id` and may link to `auth.users.id`
- all active Headliner instructor people can be safely pre-seeded as unclaimed memberships
- no duplicate person or Auth-user memberships are possible
- legacy access remains operational and unchanged for users
- notes and replies can store nullable stable membership authorship
- permissions and initial role structures are queryable through the service role
- direct browser writes to security tables are not allowed
- migration verification queries and rollback guidance are documented
- lint/build remain green because Stage 1 does not yet alter runtime behavior

---

## 15. Release-Readiness Status and Immediate Next Step

As of September 27, 2026, Migrations 011–015 are applied and the unified staff login/account-claim release-readiness audit is complete. `npm run verify:account-foundation` confirms the permission catalog, Owner/Admin mappings, all 18 planned memberships, Mae Strider's onboarding, Alex Bird's October 5, 2026 eligibility date, and disabled rollout settings. `npm run verify:account-management` covers Owner/Admin success, unauthorized denial, Admin-to-Owner escalation denial, duplicate handling, tenant isolation, optional email/phone, no unintended Auth-user creation, and mutable-fixture cleanup. `npm run verify:account-claim` covers the shared-code and personal-password paths, safe public teacher data, reminder masking and dismissal, self-invitation, email conflict handling, atomic activation, wrong-name and cross-tenant rejection, audit creation, inactive-session rejection, and cleanup. The previously stranded disposable Migration 015 fixture was removed by exact ID, and its immutable `membership.invited` audit event was retained with deleted membership links nulled as designed. No `pulse-claim-*` people or Auth users remain.

TypeScript, targeted account-release lint, and the Next.js production build pass. A broader lint sweep still reports pre-existing errors on unchanged lines in the contacts and inbox surfaces; those are not account-release regressions and should be handled as separate maintenance. `npm run verify:staff-emails` confirms all supplied staff assignments and intentionally flags only Alex Bird, whose verified email is still required before invitation. Migration mode remains disabled, `transition_starts_at` and `legacy_access_ends_at` remain unset, and no real staff invitation has been sent.

The next production step is operational rather than application development: configure the SMTP provider and DNS, set the Supabase Site URL and exact redirect allowlist, set the production `PULSE_APP_URL`, and run controlled invitation, claim, resend, and recovery delivery tests. Follow `docs/account-claim-production-rollout-checklist.md`. Do not select transition dates, enable migration mode, invite real staff, or deploy a shared-code cutoff until those tests are complete and reviewed.
