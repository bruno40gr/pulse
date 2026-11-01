# Family reconciliation and migration preview

## Owner decisions — October 31, 2026

- Account-holder, student and instructor roles can coexist on one person. This is
  ordinary domain data, not a reason to split a family or remove a role.
- Preserve existing family accounts. Retain source student-to-manager links;
  account membership does not automatically grant communication or portal access.
- Where the unique source client record has no manager, the owner approved an
  adults-ish/direct-contact assumption. This is not verified age, a birthdate
  update, legal guardianship, or consent. Missing source records and manager names
  without IDs do not qualify for that assumption.
- Billing remains separate: the intended future feature assigns a saved payment
  method per subscription. No billing changes are included in this preview.

## Results from the private read-only snapshot

The live Headliner records were reconciled by exact source IDs against the
September 25 clients, October 3 attendance and October 2 subscription exports.
These are historical exports, not confirmation of current permissions.

- 223 student identities matched unique source client records.
- 223 student plans proposed; no identity blockers under the stated rules.
- 13 direct-contact assumptions, including 9 member/active students.
- 208 distinct manager candidates: 3 exact live identities to reuse, 205 without
  an exact live source-ID match. The latter require identity review before
  creation: lack of an external-ID match does not prove a person is new.
- No account splits, role removals, automatic primary assignments, or billing
  changes are proposed.

Private reports are outside Git:
`/Users/brunowong/odeon-private/family-reconciliation/2026-10-31/`.
The report files have mode 0600. They contain personal data and must not be
copied into public artifacts. The live reads were not a transactional snapshot;
refresh and compare records before any eventual apply operation.

## Implementation gates

1. Review unmatched manager candidates against existing people lacking source
   IDs without automatically matching names, email addresses or phone numbers.
2. Confirm live relationship schema and tenant constraints. Preserve each
   student-specific manager link even when the account has several holders.
3. Implement a provenance-bearing routing assumption in the recipient resolver.
   Simply setting `message_routing=student` is insufficient while minor-first
   checks still override it; do not falsify `is_minor` to bypass that logic.
   Missing destinations still disable sending; an assumption is not consent.
4. Build a separately controlled, idempotent apply path with conflict detection,
   audit and rollback, and rehearse against staging before live writes.
5. Wire the approved UI to the real relationship directory and existing authorized
   messaging transport. Billing and payment-method mapping remain separate.

The pure preview modules contain no database/network calls and produce no
executable SQL. Nothing has been migrated, deployed or sent by this work.

## Identity review and guarded batch follow-up

- Read-only comparison against all 243 live people: 3 exact manager identities,
  203 candidates with no detected overlap against unkeyed people, and 2 manual
  identity reviews. Matching details are suggestions, never automatic merges.
- The guarded batch includes 206 identity plans and 221 student plans; 2 contact
  candidates and their 2 affected student plans are deferred. These are plans,
  not created records or newly active relationships.
- Private artifacts: `contact-identity-review.json` and
  `guarded-batch-plan.json` in the same private report directory.
- Hosted API metadata confirms `account_holders` links account/person and requires
  relationship text. It does not provide a student-specific holder edge. This
  metadata does not prove all database constraints or grants. Do not deploy a
  migration that discards the source student-specific evidence or invents a
  parent/guardian relationship to satisfy a required field.
- Pure planning tests cover deterministic fingerprints, replay suppression,
  changed-identity refusal, tenant checks and deferred dependencies.
- A disposable, network-disabled local PostgreSQL container passed a synthetic
  staging-ledger rehearsal: replay, conflict refusal, atomic rollback, audit and
  tenant-scoped keys. It did not apply the batch to hosted staging, validate the
  production relationship schema, or implement a production writer.

Next: resolve the two identity decisions; implement and rehearse the actual
tenant-validated student/contact edges and provenance-bearing routing policy.
The existing UI and live messaging paths remain unchanged by these scripts.

### Owner-reviewed identity follow-up

The owner approved reusing one reviewed existing person while preserving current
details. The explicit tenant/source/person decision is stored privately in
`owner-identity-decisions.json`; no personal identity fixtures were added to Git.
The planner accepts this decision only for the reviewed, still-unkeyed target,
preserves existing details and roles, and rejects changed or duplicate targets.
The original review and batch artifacts remain unchanged for comparison.

The revised private `guarded-batch-plan-owner-reviewed.json` contains 207 identity
plans and 222 student plans. One identity and its dependent student plan remain
deferred: the owner confirmed the person's teacher role, not explicitly that the
source manager identity should reuse that person. Teacher roles must be retained
regardless of the eventual identity decision. All results remain preview-only;
no live records or messaging policies have been changed.
## Case study: a family where the paying parent is not in Opus

Identifying details stay in the private reports; this summary uses roles only.

- An 11-year-old `Member` student (birthdate present in the source) has
  `AccountManager 1` set to an older client record whose email and phone are the
  account's email and phone.
- That older record has **no birthdate and no client Status** and lists the child as
  `Dependent 1`. It therefore looks exactly like an ordinary adult account manager
  in the export.
- The owner confirms that older record is also an **instructor**, also a **student**
  with his own lessons and subscription, and the child's **brother**; the mother who
  pays and arranges lessons has **no record in Opus**.
- Live data agrees: the older record has an `instructors` row, no `students` row,
  and the account's email and phone are his own. The child has no contact details.
- The `Staff 1..5 name` columns are instructor assignments, not guardians.

Consequences:

1. Today's minor-first routing would send the child's messages to the account's
   email and phone, which belong to the **sibling**, not the responsible adult.
2. The export cannot separate "adult guardian" from "student sibling recorded as
   account manager", so no data-only rule can resolve this family safely.
3. Instructor/student/holder overlap is normal (the owner confirmed this), so an
   instructor-owned destination is a **review** signal, not an automatic block. A
   second family's destination is owned by an instructor who is plausibly also the
   parent, and blocking instructors outright would be wrong.

## Destination policy classification

`scripts/security/family-recipient-policy.cjs` is pure and offline. For each live
student it compares the account destination against the person records that own
it and classifies the manager from the source export. Current tenant results
(223 students):

- 143 `no_blocking_signal_found_guardianship_not_inferred` (never proof of
  guardianship, consent or payment responsibility).
- 60 `owner_decision_required` (member-status, instructor-name, student-manager or
  missing-source-row signals).
- 13 `review_destination_duplicates_student_record`: the account's email or phone is
  also stored on the student's own record and **no other person shares it**. This is
  ambiguous, not proven unsafe: it can be a teenager's own number or a parent's
  number recorded on the child. No birthdate exists for any of the 13, so it cannot
  be settled from data.
- 3 `blocked_destination_owned_by_another_student`: the account's details belong to
  **another student** in the family. This is the genuine wrong-recipient case.
- 3 `blocked_no_destination_on_file`.
- 1 `owner_approved_adult_destination` (see below).

So the earlier "16 unsafe" figure decomposes into 3 wrong-recipient cases and 13
ambiguous duplicates. Every decision reports `guardianshipInferred: false`,
`activateMessaging: false` and `messagingAuthorized: false`. Owner approvals
(`approve_responsible_adult_destination`) must name the tenant, student and
destination owner, are refused for student targets, and still never enable
sending. The guarded batch records the resulting status per student plan.

## Owner decisions recorded October 31, 2026

Stored privately in `owner-decisions-2026-10-31.json`:

- The overlapping instructor/student account manager stays the **account manager**;
  his identity is reused and his instructor and other roles are preserved.
- His brother is recorded with the relationship **sibling** under that account, and
  the account manager's **phone number** is the destination for that student. This
  is an explicit owner decision, not inferred guardianship, and sending stays
  disabled until the resolver and schema work lands.
- The payer who is absent from Opus is **left for now**; the payer-differs-from-
  account-manager case is recorded as a deferred feature with the intended
  per-subscription payment method.
- Staff must be able to freely rearrange and correct these cases in the contacts
  editing experience; that requirement is recorded with the decisions.

Resulting private plan `guarded-batch-plan-final.json`: 207 identity plans, 222
student plans, 2 deferred (the remaining unresolved identity and its dependent
student), 0 live writes. The approved student now reports
`owner_approved_adult_destination` with `relationshipSource: owner_confirmed`.

Live messaging is unchanged: `lib/communication-recipients.ts` still falls back to
account destinations for minor students, which is what produces the 3
wrong-recipient and 13 ambiguous cases. Fixing that requires the schema and
resolver work in the gates above, plus the owner decisions for the 60 review cases
and the 13 duplicates — not an `is_minor` flag change.
## Contacts editing experience (owner requirement)

The owner requires staff to be able to freely rearrange and correct tricky family
cases. Current state of the code, verified by reading it:

- `app/api/contacts/[id]/route.ts` derives `account_holders` from
  `student_accounts` including its `relationship` column, so the detail path can
  already express a holder relationship.
- `app/api/contacts/route.ts` instead uses a single-account fallback and always
  reports one synthetic holder with `relationship: null, is_primary: true`, based on
  a comment claiming the schema has no `student_accounts`. The live schema **does**
  have `student_accounts` with `relationship` and `is_primary`. The list and detail
  views therefore disagree, and the list view cannot represent a sibling holder.
- Neither path currently accepts holder edits: the write routes do not create,
  remove or reorder student/holder relationships.

Planned slices, smallest first:

1. Make the list and detail holder derivation consistent and provenance-aware
   (reuse the detail derivation; keep a documented fallback when the table is
   genuinely absent). No schema change.
2. Add explicit holder editing: add/remove/reorder holders per student and set the
   relationship, with tenant checks, optimistic concurrency and audit.
3. Surface the recipient-policy status in the UI so a blocked or review-required
   student is visibly not messageable, instead of silently falling back to an
   account destination.
4. Add a "payer differs from account manager" affordance once per-subscription
   payment methods exist.

None of this is implemented yet; it is recorded here so the requirement is not
lost.

