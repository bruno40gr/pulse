# ODEON — Platform Context and Account Foundation

**Headliner Music Academy operating platform**
**Owner:** Layered Labs
**Status:** Active development
**Rebaselined:** September 26, 2026

> This document is the current high-level source of truth for the platform direction and the account foundation now being built. The original roadmap remains in `odeon-md/PRODUCT.md` as useful history and long-range product planning, but its phase statuses no longer describe the repository accurately.

---

## 1. Product Definition

ODEON is the broader operations platform for Headliner Music Academy. It is not limited to communications or CRM. The long-term product includes:

- people, contacts, families, leads, and staff
- internal notes and collaboration
- services, enrollments, classes, and rosters
- scheduling, cancellations, rescheduling, substitutions, and attendance
- makeup credits and policy enforcement
- billing, invoices, payments, discounts, credits, and payroll inputs
- third-party-funded student workflows
- staff tasks, notifications, and operational follow-up
- parent, student, teacher, and limited external access
- reporting and operational intelligence

ODEON starts with Headliner's real workflows. Multi-tenant foundations should be preserved where practical, but Headliner's needs determine build order.

### Product hierarchy

- **Layered Labs** — owner and product laboratory
- **ODEON** — Headliner's operating platform
- **Pulse** — ODEON's communications and relationship-intelligence module
- **CharterFlow** — funded-student workflow concept and possible standalone product
- **BandOS** — band-program concept and possible standalone product
- **Signal** — follow-up and operational-intelligence concept; boundaries still need validation

CRM and Notes are ODEON platform capabilities. They are not separate products merely because they were added while the application was still called Pulse.

---

## 2. Why the Scope Expanded

The repository began around Pulse: contacts, campaigns, messaging, and communication history. Real use exposed dependencies that were not explicit in the first roadmap:

```text
Communications
  → contacts
  → lead and relationship management
  → internal notes
  → replies and mentions
  → individual identities
  → permissions
  → notifications and audit history
```

The CRM and Notes work are not a departure from ODEON. They are parts of the platform that arrived earlier than expected.

The immediate task is therefore not to add another isolated feature. It is to establish the identity and authorization foundation needed by the application that already exists and by scheduling, billing, staff tools, and portals later.

---

## 3. Current State

The current repository is still named `pulse`, and some UI copy may use Pulse or Hey, Cohen. A repository rename and full visual rebrand are deferred until the account foundation is stable.

### Built or substantially built

- contact management and imports
- campaigns and outbound SMS/email workflows
- inbox and message history
- lead intake and micro-CRM workflows
- staff records and legacy staff selection
- notes with dates, completion state, filters, AI-assisted titles, threaded replies, and reply counts
- server-derived reply authorship in the legacy identity model
- reusable dashboard and slide-panel UI patterns
- initial tenant-aware helpers and settings
- a shared-code staff access flow
- partial Supabase Auth infrastructure

### Not yet established as a platform foundation

- one individual authenticated account per staff user
- verified email login and password recovery
- tenant memberships linking authenticated users to staff records
- centralized roles, capabilities, and authorization checks
- account lifecycle administration
- security and administrative audit events
- user-targeted notification inbox and preferences
- canonical parent/student portal identities
- the full services, enrollments, scheduling, billing, and portal domains

### Important correction

The presence of Supabase Auth code does not mean the staff account system is complete. Operational staff access still depends on a shared global code and a custom access session. The next phase replaces that arrangement gradually rather than pretending it is already individual authentication.

---

## 4. Platform Boundaries

ODEON should remain a modular monolith for now. Modules need clear ownership and portable concepts, but they do not need artificial separation from the domains they genuinely depend on.

### ODEON Core

Shared platform infrastructure:

- authentication and sessions
- tenants and memberships
- roles and permissions
- people, contacts, staff, and families
- account administration
- notes and internal conversations
- tasks
- notifications
- audit history
- files and documents
- tenant settings and integrations

### ODEON Operations

The internal business engine:

- services and service templates
- enrollments
- classes and rosters
- locations and rooms
- recurring schedules and session occurrences
- attendance, cancellations, rescheduling, and substitutions
- makeup credits
- billing, payments, discounts, credits, and refunds
- teacher assignment and payroll inputs

### ODEON Experiences

Controlled interfaces over the core domains:

- staff dashboard
- teacher tools
- parent portal
- student portal
- intake and enrollment forms
- scoped external links for caseworkers, documents, or approvals

### Named modules

- **Pulse:** inbox, campaigns, contextual drafting, communication preferences, reminders, and communication-triggered actions
- **CharterFlow:** funded-student cases, program rules, documents, compliant invoicing, routing, and payment tracking
- **BandOS:** bands, membership, stage readiness, setlists, curriculum, and performance opportunities
- **Signal:** tasks, resurfacing work, alerts, and operational follow-up if this proves to be a coherent standalone boundary

---

## 5. Architecture Principles

1. **Headliner first.** Solve real studio operations before optimizing for hypothetical customers.
2. **Tenant-aware by default.** Tenant-owned records should carry `tenant_id`, with access enforced on the server.
3. **Stable IDs over mutable labels.** Relationships must use IDs, not names or email addresses.
4. **Separate authentication from business identity.** An Auth user, tenant membership, staff record, and contact/person record are related but not interchangeable.
5. **Centralize authorization.** Routes should use shared authentication, membership, and permission helpers rather than ad hoc checks.
6. **Store no passwords in ODEON tables.** Supabase Auth owns credentials, verification, sessions, and password recovery.
7. **Use configuration for business variation.** Roles, transition dates, service types, policies, and program rules should not be hard-coded into route logic.
8. **Keep an audit trail.** Security-sensitive and administrative changes need actor, target, tenant, timestamp, and relevant metadata.
9. **Model operational facts explicitly.** For example, a recurring schedule rule and an actual session occurrence are different records.
10. **Prefer a modular monolith.** Keep module boundaries clear without banning necessary domain relationships.
11. **Extract only after boundaries are proven.** Standalone products may share ideas and selected primitives without forcing every ODEON module into a separate service or repository today.
12. **Humans approve consequential AI output.** AI may prepare drafts or suggestions; staff remain responsible for sending messages and making operational decisions.

---

## 6. Identity Model

The account model must distinguish authentication from a person's role inside a tenant.

```text
auth.users
    │
    └── tenant_memberships
            ├── tenant_id
            ├── auth_user_id
            ├── staff_id
            ├── role_id
            └── account state
```

### `auth.users`

Managed by Supabase Auth. It owns:

- verified email
- password credential
- authentication sessions
- recovery flow
- provider metadata

ODEON must never store plaintext passwords or its own recoverable password representation.

### `tenant_memberships`

The authorization bridge between an authenticated user and an ODEON tenant. A membership should answer:

- Which tenant can this user access?
- Which existing staff identity do they represent?
- What role or permissions do they have?
- Is their account invited, active, suspended, or deactivated?
- Have they completed the legacy-account transition?

The exact migration columns must be confirmed against the live schema before implementation. Expected concepts include:

- `id`
- `tenant_id`
- `auth_user_id`
- `staff_id`
- `role_id` or equivalent role assignment
- `status`
- `invited_at`
- `activated_at`
- `suspended_at`
- `deactivated_at`
- `created_at`
- `updated_at`

### Staff records

The existing staff record remains the operational identity used by notes, assignments, schedules, and other business records. Account activation links an Auth user to that record; it does not create a duplicate staff member.

### Email

Email is required and should be the login identifier because it is also needed for:

- verification
- password recovery
- account invitations
- security notices
- future notification delivery preferences

Display names remain separate from email and may change without breaking authorship or ownership history.

### Future portal identities

Parent and student accounts will use the same separation of concerns: Auth proves who signed in, while a membership or portal-access record defines which family, students, and actions that user may access. The staff membership design should not assume every future authenticated user is an employee.

---

## 7. Account States

Initial account states should remain small and operationally clear:

| State | Meaning |
|---|---|
| `invited` | An account setup or invitation has started but activation is incomplete. |
| `active` | Email is verified and the user may sign in according to assigned permissions. |
| `suspended` | Access is temporarily blocked without deleting history or relationships. |
| `deactivated` | Access has ended; historical authorship and audit records remain intact. |

A separate transition state or event history may be needed to distinguish staff who are still eligible for shared-code access from those who have claimed an individual account.

Deletion should not be the normal offboarding path. Deactivation preserves notes, replies, task ownership, audit events, and other historical records.

---

## 8. Legacy Shared-Code Transition

### Agreed rollout behavior

1. A staff member signs in through the existing staff-name and shared-code flow.
2. ODEON identifies the selected staff record.
3. If that staff member has not activated an individual account, ODEON shows a personalized setup modal.
4. The staff member enters an email, password, and password confirmation.
5. Supabase Auth creates the credential and begins email verification.
6. ODEON links the resulting Auth user to the existing staff record through a tenant membership.
7. Once activation is complete, shared-code access is disabled for that staff identity.
8. During the transition window, an unclaimed staff member may choose **Continue for now**.
9. After the configured cutoff, unclaimed staff can no longer enter through the shared code and must complete setup or receive admin help.

### Transition window

The expected default is **10 days**, but neither the start nor cutoff date should be hard-coded in application code.

Tenant configuration should determine:

- whether migration mode is enabled
- when the transition begins
- when shared-code access ends
- whether reminders appear and at what cadence
- whether an emergency admin override is available

The final production dates have not been selected as of September 26, 2026.

### Per-person cutoff

A claimed staff account loses shared-code eligibility immediately, even if the tenant-wide transition window is still open. This prevents a user from retaining both an individual credential and the shared credential as equivalent access paths.

### Safety requirements

- Account claiming must occur only after the legacy flow has identified a valid staff record.
- A staff record may link to at most one active Auth identity unless a later requirement explicitly supports otherwise.
- An Auth user may not silently claim a staff record belonging to another tenant.
- Duplicate or already-used emails require a controlled resolution path.
- Account creation, linking, verification, suspension, recovery, and legacy-access changes should produce audit events.
- The existing shared access path should remain available until the configured cutoff and should not be removed in the first migration.

---

## 9. Login and Recovery Experience

### During migration

The legacy screen remains available while the transition is active. After a valid legacy login, an unclaimed staff member sees setup copy along these lines:

> **Hey Josh, create your personal account**
>
> Shared-code access will end on the date shown below. Enter your email and create a password to keep access to ODEON.

Actions:

- **Create my account**
- **Continue for now** — available only before cutoff

The date in the UI must come from tenant configuration.

### After migration

The primary staff login becomes:

- email
- password
- forgot-password link

Supabase Auth handles recovery email delivery and secure password reset. ODEON handles tenant membership and account-state checks after authentication.

### Email verification

Email verification is not required before the membership becomes active. ODEON may still record `email_verified_at` when Supabase reports verification, and the tenant setting preserves the option to require it later if policy changes.

---

## 10. Authorization Model

Authentication answers who the user is. Authorization answers what that user may do in a tenant. They must not be collapsed into one check.

Server-side access should converge on shared helpers with responsibilities equivalent to:

```ts
requireAuthenticatedUser()
requireTenantMembership()
requirePermission(permission)
```

Names may change to match repository conventions, but the separation should remain.

### Initial role direction

The initial rollout deliberately uses only two assigned roles:

- **Owner** — Bruno Wong and Lorena Rudha
- **Admin** — every other active staff member

Owner and Admin have identical capabilities at launch. No practical access distinction is needed yet. The role and permission structure still exists so the business can introduce Operations, Teacher, Read-only, or other boundaries later without redesigning accounts.

For now, staff retain broad visibility, including access to all current contacts and notes.

Only memberships with the exact protected Owner or Admin role may access the **Access & roles** administration area. Either role may review staff account state, explicitly Invite or Resend, and manually add unclaimed accounts. Manual creation may add an eligible existing staff identity or create a new staff person and membership together; email and phone are optional, and the operation does not create a Supabase Auth user or send an invitation until Invite is explicitly selected.

Role and permission administration is restricted to the exact Owner and Admin roles. Both may assign roles, create reusable roles, and configure each non-Owner role's capabilities; assigning the Owner role remains Owner-only. Custom roles cannot gain this administration surface through a configurable capability. The Owner role itself is protected, always retains full access, and cannot be removed from the final Owner in a tenant.

Roles should map to named capabilities. Routes and UI should check capabilities rather than scattering role-name comparisons throughout the codebase.

Candidate capability groups:

- account and role administration
- staff administration
- contact and family access
- lead management
- notes and replies
- communication sending
- scheduling and attendance
- billing and payment operations
- reporting
- tenant settings
- audit-log access

### Enforcement rules

- Security decisions happen on the server, not only by hiding UI controls.
- Every tenant-owned query must be tenant-scoped.
- Service-role Supabase access must not bypass application authorization accidentally.
- Authorship and assignment should come from the authenticated membership, not from client-submitted names.
- Permission failures should be explicit and auditable where appropriate.

---

## 11. Notifications and Audit History

Notifications come after identity and authorization because they require a stable recipient.

### Notifications

The first notification system should support:

- a user-targeted inbox
- unread/read state
- links to the relevant ODEON record
- initial event types such as mentions, replies, and task assignments
- per-user preferences later
- optional email delivery later

A notification should target a membership or stable user identity, not an email address or display name.

### Audit history

Audit events are separate from notifications. They should record important security and administrative actions even when no user-facing alert is needed.

Initial events should include:

- account invited
- account claimed
- email verified
- password recovery requested or completed where available safely
- role or permission changed
- account suspended, restored, or deactivated
- legacy shared-code access disabled or overridden
- admin-assisted account relinking

Audit records should include tenant, actor, target, event type, timestamp, and safe metadata. Secrets, passwords, recovery tokens, and full credentials must never appear in logs.

---

## 12. Immediate Implementation Plan

The account work should be delivered in small, testable stages.

### Stage 0 — Reconcile documentation and live schema

- treat this file as the current platform/account brief
- preserve `odeon-md/PRODUCT.md` as the original roadmap and decision history
- audit the deployed and migration-defined schemas
- inventory all current auth/session checks and staff-identity assumptions
- inventory active staff emails for missing, invalid, or duplicate values
- confirm the initial role/capability matrix and elevated users
- choose rollout dates through configuration, not source edits

### Stage 1 — Account schema

- add tenant memberships and account-state fields
- add role/capability structures using the simplest design that meets current needs
- add transition configuration and event/audit storage
- add uniqueness and tenant-integrity constraints
- backfill safely without disabling the legacy path

### Stage 2 — Server identity and authorization

- implement centralized authenticated-user resolution
- resolve tenant membership and linked staff identity
- implement permission checks
- update protected APIs incrementally
- ensure author/actor fields are server-derived

### Stage 3 — Account claiming

- show the setup modal after legacy login for eligible staff
- collect email and password securely through Supabase Auth
- record email verification when Supabase reports it; do not require it under the initial tenant policy
- link to the existing staff record
- disable shared-code access for the claimed identity
- support **Continue for now** only before the configured cutoff

### Stage 4 — Primary login and recovery

- support email/password staff login
- add forgot-password and reset-password flows
- enforce membership and account status after Auth login
- preserve the legacy route only for eligible, unclaimed staff during transition
- enforce the configured tenant-wide cutoff

### Stage 5 — Account administration

- manually add an eligible existing staff account or create a new staff identity and unclaimed membership
- list staff account and transition states
- invite or resend setup
- assign roles
- suspend, restore, and deactivate accounts
- provide controlled resolution for duplicate email or incorrect staff linking
- expose appropriate audit history

### Stage 6 — Notifications

- add the notification data model and inbox
- connect note mentions and replies first
- add task assignments next
- add preferences and optional email delivery after the in-app model is stable

### Delivery rules

- one focused implementation brief at a time
- additive migrations before destructive cleanup
- preserve existing access until replacement paths are tested
- test route authorization, tenant isolation, transition edge cases, and account-state behavior
- commit each independently testable stage
- remove the shared-code system only after the transition is complete and an explicit cleanup decision is made

---

## 13. Domain Build Order After Accounts

Accounts are a foundation phase, not a replacement for the broader roadmap. The recommended order after identity and authorization is:

1. **Canonical people and family model** — reconcile contacts, staff, students, parents/account managers, families, and Auth identities.
2. **Services and enrollments** — define what a person is enrolled in, with pricing, policy, teacher, and status history.
3. **Scheduling foundation** — recurring schedule rules, actual session occurrences, rooms, assignments, classes, and rosters.
4. **Operational scheduling** — attendance, cancellation, rescheduling, substitutions, and makeup credits.
5. **Billing** — charges, invoices, payments, credits, discounts, refunds, third-party payer allocation, and payroll inputs.
6. **Parent and student portal** — a controlled experience over stable family, enrollment, schedule, billing, document, and communication domains.
7. **Reporting and automation** — metrics and triggers based on reliable operational data.

CharterFlow and BandOS can advance where Headliner's priorities justify them, but they should use the same identity, people, enrollment, and authorization foundations rather than creating parallel versions.

---

## 14. Naming and Branding

Current direction:

- **ODEON** is the working name for the full platform.
- **Pulse** remains the communications and relationship-intelligence module.
- The repository may remain named `pulse` during the account work.
- Existing UI naming should be changed deliberately, not through a broad search-and-replace.
- Public investment in the ODEON name should wait for domain and trademark clearance.

The name is therefore usable for internal architecture and planning, but external launch branding remains provisional.

---

## 15. Confirmed Rollout Defaults and Remaining Decisions

Confirmed defaults:

- Bruno Wong and Lorena Rudha are Owners.
- Every other active staff member is an Admin.
- Owner and Admin initially have the same permissions.
- Staff retain broad visibility for now.
- Admin-initiated invitations are allowed.
- Email verification is not required before access.
- Emergency legacy access after cutoff is not allowed.
- Migration mode remains disabled until the flow is safe to launch.

Still to decide before rollout activation:

1. What are the exact transition start and cutoff timestamps?
2. What happens when a staff email already belongs to an existing Supabase Auth user?
3. How should the two existing unmatched Auth users be handled?
4. Which account and security events need to appear in the first administration UI?
5. What final copy and interaction design make account status, invitations, and role assignment easiest for staff to understand?

---

## 16. Guardrails

- Do not create a second staff record when activating an account.
- Do not use email or display name as a foreign key.
- Do not trust client-supplied author, actor, tenant, role, or permission values.
- Do not store passwords or recovery tokens in ODEON tables or logs.
- Do not hard-code rollout dates.
- Do not disable the legacy path before the replacement is verified.
- Do not delete former users to represent offboarding.
- Do not build notifications before stable recipient identities exist.
- Do not let every route invent its own tenant or permission check.
- Do not make scheduling the source of truth for enrollment.
- Do not make Stripe the source of truth for ODEON's billing model.
- Do not merge funding organizations into family or account-holder records; funded-student cases should reference the appropriate program/funder model.
- Do not force theoretical standalone extraction at the expense of a coherent ODEON platform.

---

## 17. Definition of Done for the Account Foundation

The account foundation is complete when:

- every active staff member can use an individual verified email/password account
- each Auth user is linked to the correct tenant and existing staff identity
- password recovery works through Supabase Auth
- shared-code access is controlled by configuration and disabled per person after activation
- the tenant-wide cutoff is enforced without a deployment
- roles and permissions are enforced server-side through shared helpers
- admins can view and manage account states safely
- important account and permission changes are audited
- Notes and other collaborative records derive authorship from the authenticated identity
- notifications can target a stable user or membership
- tenant isolation and the major migration edge cases have automated coverage
- the legacy shared-code implementation can be retired through a separate, deliberate cleanup step

---

## 18. Source-of-Truth Rules

Use the documents as follows:

- **`odeon.md`** — current platform framing, account architecture, near-term implementation order, and active guardrails
- **`odeon-md/PRODUCT.md`** — original roadmap, long-range module ideas, and historical decisions
- **`odeon-md/CharterFlow_BRD.md`** — detailed CharterFlow domain requirements
- **`docs/leads-crm-status.md`** — lead/CRM rollout status, until folded into a newer implementation status document
- **implementation briefs and migrations** — exact scope and schema for a specific stage

When these documents conflict about the current platform or account direction, this file governs unless a newer dated decision explicitly supersedes it. Historical decisions should be corrected with a dated note rather than silently erased.

---

## Next Action

As of September 27, 2026, the additive account foundation through Migration 015 is applied and the final local release-readiness audit is complete. Personal-account claiming is implemented with atomic membership activation: Owner/Admin can explicitly Invite or Resend, eligible unclaimed staff can request their own setup email from the reminder, staff can set a password, active linked Supabase sessions can enter Pulse, recovery is limited to active memberships, unrestricted signup redirects to sign-in, and claiming disables that member's legacy access. Role and permission administration is restricted to exact Owner/Admin roles; assigning Owner remains Owner-only. `npm run verify:account-foundation`, `npm run verify:account-management`, and `npm run verify:account-claim` pass against the target environment. The claim verifier covers safe public dropdown data, reminder masking and session dismissal, invitation and activation, password sign-in, per-member legacy disablement, wrong-name and cross-tenant rejection, email conflicts, audit creation, inactive-session rejection, and disposable-fixture cleanup. TypeScript, targeted account-release lint, and the production build also pass. `npm run verify:staff-emails` confirms every supplied assignment and intentionally remains nonzero only because Alex Bird still needs a verified email before his future eligibility date of October 5, 2026. Migration mode remains disabled, rollout timestamps remain unset, no real staff invitations have been sent, and production activation is blocked on SMTP/DNS configuration plus controlled delivery testing.