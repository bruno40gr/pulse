# Improve through reconciliation, not replacement

These principles capture the Beta integration decisions and corrections from
November 13, 2026. They apply to subsequent Beta iteration and prototype promotion.
Read with `AGENTS.md`, `docs/component-reuse-directives.md`,
`docs/ui-layout-rules.md` and `docs/branch-and-worktree-rules.md`.

## 1. Improve the product; do not freeze its old appearance

- Shared UI improvements should benefit existing screens as well as Beta when
  that is the agreed scope. A visual difference alone is not a regression.
- Preserve or improve functionality, permissions, accessibility, validation,
  submitted values, responsive behavior and draft continuity. Check these
  independently of appearance.
- The user owns material UX choices: layout, navigation, wording, action
  placement and interaction patterns. Surface gaps instead of silently inventing
  a new experience. Technical ownership is not UX approval.
- Make additive options when behavior is specific to a new workflow. Do not
  regress established defaults for callers that do not opt in.

## 2. Reconcile against the newest implementation

- Inspect the destination, its callers and the source dependency graph before
  editing. Classify each file: already equal, additive improvement, divergent
  behavior needing reconciliation, or destination-only module to preserve.
- Treat prototypes as a source of reviewed improvements, not a replacement tree.
  Never copy old APIs, permissions, security checks or screens over newer main
  code simply to satisfy imports or make a prototype test pass.
- Retain main's family calendar, makeup references, Reschedule together,
  account-context loader, cache/pagination, SMS safeguards and supporting modules
  unless an explicit, tested replacement is approved.
- A clean textual merge does not prove semantic compatibility. Inspect defaults,
  callbacks, effect dependencies, error handling and response contracts.
- Existing tests/harnesses may already be newer than the prototype repair. Keep
  the working destination harness; do not weaken assertions to hide regressions.

## 3. Reuse complete experiences, not lookalikes

- Reuse the actual Contacts/Leads composition, tables, family hierarchy, row
  menus, selection toolbar, forms and detail panels. Using shared buttons in a
  parallel custom screen does not establish experience reuse.
- Keep selection counts, clear actions and the established blue contextual bar.
  Extend existing action surfaces rather than scattering buttons into filters.
- Extract adapters or shared compositions where operational coupling blocks
  simulation. Inspect framework constraints before extraction: Next page modules
  are route entry points, not arbitrary prop-driven workspace components.
- Preserve existing defaults; opt-in contexts and props must not silently change
  production permission loading, transport or messaging behavior.

## 4. Preserve the destination's data ownership

- **Beta's existing sample database wins.** Reuse its contact, account and student
  IDs, relationships, calendar and billing context. Do not import a second fake
  directory from the prototype or match identities by name/shared email.
- Adapt existing records into workflow models. Do not fabricate provenance,
  memberships or inquiries to fill UI gaps. Empty workflow state is preferable
  to silently introducing unrelated prototype records.
- Keep isolated test fixtures explicitly injected. Tests may use tiny fictional
  scenarios without making them runtime defaults.
- When a data boundary changes, version/isolate persistence so an older session
  cannot restore the rejected fixture directory. Preserve old storage rather
  than indiscriminately clearing unrelated tester work.
- The current queue starts from the existing Beta sample seed. Synchronizing
  later session edits into every staff/parent consumer remains an integration
  responsibility; do not claim that a projection is a durable shared database.

## 5. Simulate transport, never authority

- Keep exactly one queue/store/hook module for Beta staff and Parent consumers.
  Mixed private/root imports must not instantiate separate stores.
- The queue is fictional same-tab browser-session transport. It is neither
  authentication nor server authorization, durable booking or payment processing.
- Unknown simulated operations must fail closed, not fall back to operational
  APIs. Audit reads as well as writes, including insights, recipients, notes,
  AI, imports, calls, messages and account panels.
- Default operational transport and server-side permissions remain intact.
  Before real contacts, implement server-owned tenant/account/student grants;
  before real transactions, authoritative pricing/policies, reservations,
  idempotent bookings and verified payment events are required.
- Do not remove a prototype's development-only access guard to publish a flow.
  Navigation placement and deployment access checks are separate release gates.

## 6. Validate the boundary that actually ships

- Run domain/adapter tests, permission/security regressions, TypeScript, lint and
  whitespace checks. Validate all edited files, including untracked additions.
- Test integrated desktop/mobile flows: selected/unselected states, menus,
  keyboard controls, open/save/resume, sibling isolation and completion/payment
  distinctions. Record runtime errors, unexpected network requests and overflow.
- Use the integration worktree in the browser host, not the original prototype.
  A host that omits production middleware cannot prove deployment access safety.
- A dependency audit is not a runtime check. Exercise Sharp image processing.
  Compilation/type success is not a completed production build.
- Do not copy production secrets to unblock a build. Use approved nonproduction
  configuration; report missing configuration as an explicit blocker.
- Separate passing tests from visual approval, and measured performance from
  assumptions. Retain newer performance work and optimize based on evidence.

## 7. Iterate without losing work

- Work in the named integration worktree; do not modify the original main or
  prototype worktrees to resolve integration conflicts.
- Checkpoint coherent, validated changes. Keep unrelated/unreviewed WIP out of
  documentation-only or data-correction commits. Say when the worktree is dirty.
- Never claim merged, pushed or deployed when work is only local. Distinguish
  implemented, reachable, tested and approved states in progress notes.
- Keep one current status section. Label historical checks as historical instead
  of leaving contradictory claims such as “no browser checks” after checks pass.
- Keep release-blocking evidence in durable documentation and backup archives;
  `/tmp` logs are useful evidence, not permanent storage.

## 8. Clean up only with proof and recovery

- Confirm live remote refs and exact commit ancestry. A branch name, closed PR,
  or equivalent-looking diff is not sufficient proof of a completed merge.
- Protect active/checked-out branches, named protected refs, dirty worktrees and
  stashes. Unmerged or squash/cherry-pick-equivalent work requires explicit review.
- Before deletion: bundle all refs, archive dirty/staged/untracked/ignored source
  files, retain manifests/hashes, make the required second bundle copy, restore
  every local branch and replay archived work in a disposable repository.
- Delete only verified merged candidates with safe Git operations. No forced
  deletion, history rewriting, automatic remote deletion or immediate pruning.
- Retain the integration-line exception until release review. A tidy branch list
  is not worth losing the prototype vision, recoverability or uncommitted work.

## Lessons from this pass

1. Main already contained many shared controls and the newer conversation
   harness; copying prototype equivalents would add risk without improvement.
2. Main's newer APIs resolved the prototype's Leads test failures. The fix was
   preserving those APIs, not replacing them or relaxing their tests.
3. A seemingly harmless queue seed introduced a separate fake contact directory.
   Correction `17d958e` uses existing Beta identities, removes Parent-family
   injection and isolates queue persistence as `odeon:beta-enrollment-portal:v2`.
4. Shared adapters must match the destination's summary-only and include-counts
   contracts while retaining account-context single-flight loading and caching.
5. Parent workflows can be reconciled without replacing the newer calendar and
   Reschedule together. Targeted browser regressions verified those behaviors.
6. The full staff Explorer remains unexposed WIP. Ported files and passing types
   alone are not a finished Contacts integration or navigation decision.

For commits, evidence and remaining release gates, use
`docs/beta-integration-progress.md` rather than treating this principles document
as a deployment status report.