# Enrollment and teacher-benefit decisions

**Evidence:** Owner's situational walkthrough in this conversation. These decisions refine earlier planning proposals; they are not a live configuration, payment integration or migration approval.

## Enrollment and identity

- Enroll the person normally; do not ask staff to manually “add a student role.” A confidently linked existing person gains the required student relationship behind the scenes, preserving staff identity, teaching assignments and permissions.
- Match strong, unambiguous identities automatically. A same-name/different-email match requires staff review while preserving the submission; do not merge it or award the matched teacher's benefit prematurely. Exact match criteria beyond this example remain to be specified; email/name alone are not established universal identity keys.
- A student's role and the teacher on their enrollment are independent. One person may both teach and learn. The two staging instructor references target different identity tables and cannot be populated with interchangeable UUIDs.

## Lead-to-contact lifecycle and email continuity

Owner clarification, October 28, 2026; requirements, not implemented behavior:

- After a lead is won and enrollment is established, the person is promoted to the enrolled-contact experience. Preserve the existing linked CRM contact where present; promotion must not create a duplicate identity or discard the original inquiry.
- The contact must retain access to historical emails sent during the lead stage as well as subsequent correspondence. Promotion must not reset the visible history. Complete historical coverage is a requirement, not a claim that current capture has imported all past mail; provider availability, capture limits and any scoped recovery/import remain implementation work.
- While the enrolled/won lead remains in the Leads tab, relevant email correspondence must continue to be registered as notes in its lead panel, including after conversion. Lead-note capture and contact-history visibility must not be gated by conversion-automation statuses. Capturing correspondence must not regress an Enrolling, won or enrolled lifecycle state.
- Lead and contact views should reference the same underlying correspondence with stable provenance and deduplication, rather than making destructive transfers or independently duplicating message records. Preserve tenant/mailbox access controls and review ambiguous person/inquiry matches instead of guessing from a shared address.
- The permanent exit rule for enrolled leads from the Leads tab is **undecided**. Completing Odeon and migrating off Opus1 is the owner's proposed milestone, not an approved automatic removal trigger or a scheduled migration. Do not hide, delete or move existing enrolled leads on the strength of this planning note. Leaving Leads must eventually be a visibility/lifecycle change, not deletion of the inquiry or its communication history.
- Acceptance coverage should include pre-enrollment history in the contact, continued post-conversion notes while the lead remains visible, no conversion-state regression, idempotent capture across both views, and history retention after eventual removal from Leads. Existing missed mail needs a separately verified recovery path; widening future capture does not rewind a completed cursor.

## Teacher benefit and offers

- Saved offers can have automatic eligibility conditions. Headliner: active teacher status qualifies, even without current teaching assignments; automatically apply the 50% teacher benefit to all eligible enrollments.
- Related students require individual staff approval tied to a sponsoring teacher; household/email/account membership does not itself qualify them.
- Benefits end at the recipient's next billing period when the sponsoring teacher becomes inactive. No retroactive repricing of past charges. On reactivation, the teacher's own benefit resumes automatically; related students require fresh approval. The exact reactivation effective-date mechanics remain to be specified.
- Discounts **never stack**; apply the best eligible offer. A scoped exception such as a free first lesson wins for that lesson only, after which the normal eligible benefit resumes. Compare actual payable outcomes for the same covered scope, not just percentage labels; tie/rounding/calculation details remain implementation work.
- Odeon supports configurable enrollment limits; Headliner allows all eligible enrollments. Support both grandfathering accepted offer versions and updating existing applications. Headliner chooses updates from each enrollment's next billing period, preserving prior terms and issued bills. “Retroactive” in the discussion meant including existing enrollments going forward, not rewriting prior periods.
- These decisions supersede earlier suggestions that teacher benefits must always be manually selected, stacking might be configurable, or saved-definition edits can never propagate. Propagation is explicit policy-driven versioned change, not silent mutation of historical snapshots.

## Booking and payment request policy

- Support staff-assisted matching: students provide availability and staff find a teacher/time. Requested availability and an agreed slot are distinct.
- Also support student self-enrollment/self-booking. One-off, à-la-carte and recurring paths are needed; no universal trial requirement.
- Headliner currently uses approval-based self-service requests. Future instant confirmation is a configurable mode only after scheduling, conflict prevention and payment handling are reliable; it is not implemented by this decision.
- A ready saved card is required before a request enters staff review. Clear wording: **“A card is required to submit your request. You won’t be charged until we confirm your lesson.”** Suggested action label: **“Submit booking request.”** Neither card storage nor request submission is payment.
- Staff approval precedes collection. Until required payment succeeds, the request is not fully confirmed; a failed attempt returns it to pending payment so the student can resolve payment. Student/staff communication should distinguish approval from completed booking confirmation.

## Implemented pure request contract

`/Users/brunowong/pulse/lib/academy-booking-request.ts` models:

```text
draft --card ready + submit--> awaiting_confirmation
awaiting_confirmation --staff approve--> pending_payment
awaiting_confirmation --staff reject--> rejected
pending_payment --start attempt--> processing_payment
processing_payment --matching success--> confirmed
processing_payment --matching failure--> pending_payment
```

An attempt ID correlates completion to the current processing attempt; mismatched/stale IDs reject. Duplicate completion rejects and must be deduplicated by a future provider adapter. This is not persisted idempotency or permission enforcement. The pure helper receives trusted evidence and never invokes collection, stores a card, reserves a slot or sends a notification.

**Integration gaps:** verified provider card setup/customer ownership/consent, staff authorization, accepted terms/amount and schedule validation, slot hold/expiry and concurrent booking control, transactional persistence/outbox, durable attempt/event deduplication, card revalidation, ambiguous/delayed provider outcomes, cancellation/refunds, no-payment-due/free bookings and future instant-booking mode. In particular, a delayed success on an older attempt requires reconciliation—not assuming payment did not occur. Do not initiate another live attempt until provider status is reconciled. Free lessons must not require a fake successful transaction; that branch remains unimplemented.

The card-required rule applies to requests entering the discussed booking flow, not a ban on collecting initial inquiries without payment details. No hosted billing/provider action is authorized by this document.

## Validation

`/Users/brunowong/pulse/scripts/academy/booking-request.test.cjs`: **12 new tests passed**. Combined `npm run test:academy`: **145 passed**, zero failed/skipped. TypeScript, targeted academy ESLint and `git diff --check` passed. No UI/routes, hosted queries, migrations, provider integrations or live financial changes were made. Teacher-benefit automation is recorded policy, not implemented functionality.