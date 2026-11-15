# Prototype → Beta integration plan

## Decision and scope — November 13, 2026

Shared UI improvements are intended to benefit operational screens as well as
Beta. Visual differences are not automatically regressions. Preserve improved
compositions and defaults while checking actions, submitted values, selection,
drafts, permissions, accessibility and responsive behavior. Do not freeze the old
appearance or indiscriminately replace newer main implementations.

This document records inspection and a proposed integration sequence, not a merge
or deployment. Both worktrees contain uncommitted work; preserve both.

- Prototype: `/Users/brunowong/pulse-odeon-integration`, branch
  `explore/events-and-booking`, HEAD `ddcefa1` plus local changes and untracked files.
- Main: `/Users/brunowong/pulse`, HEAD `9d5c5cc` plus local changes.
- `git ls-remote --heads origin main` confirmed `9d5c5cc` during this inspection.
- Committed history diverges by 104 main-only and 25 prototype-only commits.
  These counts exclude local changes. A whole-branch replacement is inappropriate.

## Actual Beta boundary

Main's `/beta` redirects to `/odeon-demo`, preserving query parameters.
The `/odeon-demo` and school-setup wrappers import from `beta-source`.
The Beta workspace deliberately imports operational Contacts and its sample
context, while most academy screens and dependencies remain under `beta-source`.

The prototype's event-explorer route is development-only and owner/admin gated.
Copying its files does not expose these flows in deployed Beta. Route access,
Beta navigation and the staff-workspace entry need deliberate integration; do not
remove the development guard and silently publish the standalone explorer.
Reuse the existing Beta shell rather than automatically adopting the explorer's
separate shell. Final navigation placement remains a UX decision.

Comparing main's 251 `beta-source` files with prototype counterparts, normalizing
`@/beta-source/` imports only, found 206 equal files, 40 different files and five
files with no prototype counterpart. This is a source inventory, not a statement
that all differences should be copied. Compare shared imports separately.

## Shared UI promotion and reconciliation

Paths in the following tables are relative to the repository roots above.

| Surface | Verified comparison with committed main | Treatment |
| --- | --- | --- |
| `components/ui/Button.tsx`, `DataGridTable.tsx`, `Select.tsx`, `PersonName.tsx`, `FormControl.module.css` | Prototype working copies already match main's shared implementations | Retain main; no replacement needed to obtain these improvements. Beta's private counterparts differ in places; converge only after checking their callers. |
| `components/ui/TableWorkspaceControls.tsx` | Main already has shared discovery/results/blue contextual action compositions; prototype adds optional `selectionNoun` | Carry the additive option forward, preserving main's existing actions, count, clear and responsive behavior. |
| `components/ui/Tabs.tsx` | Prototype adds optional `countAppearance: 'bubble'` | Promote the option without changing callers that do not request it. |
| `components/ui/Checkbox.tsx` | Not present at main's shared path; Beta has a private counterpart | Promote the shared primitive and intended horizontal label alignment where consumed; audit surrounding CSS instead of copying all private UI. |
| `components/ui/RadioOptionGroup.*`, `WeekdayToggleGroup.tsx`, `ParticipationPolicies.tsx`, `SaveStatusNotice.tsx` | New shared compositions in prototype | Add with their styles/dependencies and use in the relevant flows. Availability does not mean replacing every existing control globally. Policy rendering is not server policy enforcement. |
| `components/ui/ModalStepper.tsx` | Beta counterpart differs; prototype supports optional step navigation/completion | Retain additive capabilities; verify callers cannot skip required validation on final submission. |
| `components/contacts/FamilyListTable.tsx`, `AccountFamilyPanel.tsx` | Exact working-copy matches to main | Retain main's versions and established family hierarchy. |
| `components/leads/LeadFollowUpCell.tsx`, `LeadBulkFollowUpPanel.tsx` | Exact working-copy matches to main | Retain main's versions and their server contracts. |
| `components/leads/LeadInlineEditor.tsx` | Difference is request transport through `useLeadWorkspaceRequest`, not a wholesale new inline editor | Add adapter support to main's current editor; absent adapter continues to use operational fetch. Preserve validation, concurrency handling and save/discard behavior. |
| `components/ui/TableDisplayControls.tsx` | Prototype adds sample-local preference loading; main worktree also has newer local edits | Reconcile all three versions. Preserve operational tenant/identity behavior and newer local performance work; isolate sample keys and requests. |
| Contacts, Leads, messaging, notes and composers | Adapters/local save notices and matching/enrollment actions touch shared production code | Port focused additions onto main. Verify default operational transport, templates, recipient eligibility, opt-outs, authorization and draft retention. |

New primitives are not a mandate for blanket UI replacement. Keep complete shared
compositions where they already exist. Do not create a second Contacts/Leads UI
merely to support fictional data.

## Beta screens and workflow/model impact

| Screen / flow | Incoming behavior and model | Existing behavior to retain / reconcile |
| --- | --- | --- |
| Staff Contacts / Opportunities | Existing people create opportunities in place; shared Leads composition operates through a simulated adapter; relationship and source remain distinct | Main's current client-type filters, family views, preferences, detail loading, permissions and operational requests. Prototype `lib/contact-filters.ts` lacks main's newer `matchesClientTypes` helper; retain main's implementation. |
| Enroll & Book / lesson enrollment | Account-holder selection, separate “Classes are for this person”, students/siblings, saved drafts, explicit send, family continuation | Main's existing enrollment/calendar capabilities and validation. Completing one child must not overwrite another. |
| Bands / groups | Candidates, enrollment requests, participant schedules, quotes/subscriptions and existing paid-coverage assignment | A request is not membership; paid coverage must not charge again; completion must remain sibling-safe and reject duplicate/stale operations. |
| Program proposals | `ProgramPlan`, availability tasks, proposed schedules and family confirmation | Preserve task/student/institution association and schedule revision validation. Availability/confirmation must not imply a real booking. |
| Events | Event defaults, daily/activity schedules, capacity, pricing, policies/forms and registration review | Preserve participant/capacity validation; do not publish example sharing URLs as real signup endpoints. |
| Parent portal | Family-filtered inquiry/request/task queue and resumable lesson/Band editors | Retain existing account navigation, calendar, makeups and billing previews; client filtering remains correctness logic, not authorization. |
| School Setup | Configured service images, program/group/event settings and shared policy editing | Reconcile main Beta's newer layout/style changes; define configuration/session lifetime before treating restored drafts as canonical. |

The new queue owns explorer state, academy configuration, inquiries, Band
requests/enrollments, program tasks, bookings and workflow drafts. Its store uses
`useSyncExternalStore`, a shared current snapshot and session persistence. Named
commands cover sending/opening/saving family enrollment and validate related
writes against the same snapshot. `withQueueAccounts` projects linked fictional
families/students into the Beta sample workspace.

These are browser preview models, not database migrations or authoritative
enrollment/payment records. Existing checkout state is not the canonical
calendar/billing model. Do not connect real contacts to this queue, trust browser
payment flags, or infer durable bookings from successful preview completion.

## Main/Beta work that must not be overwritten

1. Beta family calendar references: regular lessons and booked makeups, sibling
   visibility/isolation, moving-occurrence markers and week retention.
2. Reschedule together: selection toolbar, independent per-lesson draft choices,
   focused availability and explicit confirmation. Five main-only counterparts:
   - `beta-source/app/content-studio-prototype/students/FamilyReschedule.tsx`
   - `beta-source/app/content-studio-prototype/students/LessonSelectionToolbar.tsx`
   - `beta-source/app/content-studio-prototype/students/LessonSelectionToolbar.module.css`
   - `beta-source/lib/family-booking-calendar.ts`
   - `beta-source/lib/family-reschedule.ts`
3. Related main Beta changes in `MoveLesson`, `MakeupWorkspace`,
   `UpcomingBookings`, `WorkspaceSections`, calendar layout/legend,
   `CalendarWeekToolbar`, `LessonSchedule` and CSS. Keep the bundled-font build
   repair and compact/right-column booking controls.
4. Main's server routes, tenant/role checks, request-context work, contact/lead
   detail performance and visible single-flight messaging refresh. Do not copy
   older prototype API/middleware implementations over these.
5. Main worktree's uncommitted Leads API, dashboard loading/layout/settings,
   Leads/table-preference performance work and associated tests. Capture an
   explicit checkpoint before any integration branch is created.

## Release blockers and evidence

- Saved production audit `/tmp/odeon-audit-dependencies.json`: eight affected
  packages (one critical, six high, one moderate), including Next 15.5.22.
  Both committed manifests use the same Next range. This is saved evidence,
  not a fresh audit or an exploitability assessment. Refresh the audit/dependency
  tree on the integration baseline; choose compatible fixes and validate them.
  Do not run a blind forced upgrade. No dependency changes made in this pass.
- Conversation harness: explicitly load `lib/sticky-note-appearance.ts` into
  `lib/tokens.ts`'s allowlisted VM dependencies. Before: 24 dependency-loading
  failures. After: 31/31 conversation-prototype tests pass; focused lint passes.
  Application behavior and assertions are unchanged.
- Initial wider baseline: 514 tests, 505 passed, nine failed. Eight failures are
  in `lead-bulk-follow-up.test.cjs`: the prototype's older server routes do not
  satisfy newer owner-only deletion, follow-up permission, validation and update
  contracts. Main contains newer handling. Preserve it and rerun the tests on the
  integrated baseline; do not weaken tests or copy older routes to silence them.
  The ninth failure was a 1000ms VM timeout in a staff-enrollment test under the
  wider concurrent run. Rerunning with `--test-concurrency=2` produced 506 passes
  and the same eight Leads failures, with no timeout. TypeScript also passes.
- Evidence: `/tmp/odeon-integration-harness-{before,after}.log`,
  `/tmp/odeon-integration-harness-lint.log`, and
  `/tmp/odeon-integration-baseline-tests.log`,
  `/tmp/odeon-integration-baseline-controlled.log`, and
  `/tmp/odeon-integration-types.log`.
- The temporary preview at port 3222 bypasses production middleware. It cannot
  validate Beta deployment access controls. No integrated build/browser run has
  occurred in this planning pass.

## Execution order and acceptance gates

1. Preserve/checkpoint both worktrees without dropping untracked files or secrets;
   create a dedicated integration branch from the agreed main checkpoint. Do not
   merge unrelated dirty changes by accident or modify the original worktrees to
   resolve conflicts.
2. Refresh dependency evidence and patch compatible versions on that branch.
   Carry the small conversation harness repair forward separately.
3. Promote only outstanding shared improvements onto main's newest components;
   keep already-equal components. Reconcile local performance work explicitly.
4. Port Beta domain/store/workflow additions into the existing Beta boundary,
   maintaining one shared queue instance for its staff/parent consumers. Avoid
   creating parallel queue stores through mixed private/shared imports.
5. Reconcile Parent/School Setup/enrollment screens with main's newer calendar and
   reschedule flows. Resolve Beta navigation placement before changing it.
6. Run domain, transport, authorization, Contacts/Leads follow-up, identity and
   calendar tests, TypeScript, lint and the production build. Run actual integrated
   desktop/mobile browser checks: selected/unselected action bars, row menus,
   radio/checkbox keyboard behavior, inline save/cancel/error, family/sibling
   isolation, draft continuation and paid/unpaid completion. Verify fictional
   Beta actions perform no operational writes and production access gates apply.
7. Review the resolved impact/diff and release Beta with rollback/checkpoint
   information. No real contact import or payment activation in this release.
8. Before real contacts: design/implement server-owned tenant/account/student
   grants and scoped reads. Before live enrollment/payment: authoritative
   quotes/policies, atomic reservations/bookings, idempotency, verified payment
   events and explicit canonical calendar/billing ownership.

Structural extraction of remaining multi-setter explorer workflows can be
incremental. It is not a reason to delay Beta unless correctness or reconciliation
requires it. Profile realistic datasets before further persistence/subscription
optimizations.
