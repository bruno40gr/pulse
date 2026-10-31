# Chris Moon missing email — investigation checkpoint

Date: October 28, 2026

Status: production database identity and captured-note records verified read-only; the missing follow-up's provider evidence is not yet verified. No live mailbox queries, sync jobs, test sends, backfills, or schema changes were executed for this checkpoint.

## Production findings — corrected environment

The Supabase project inventory identifies `xpnygavujqmzkdmcktdm` as **Odeon-staging**, `jbrntsxmibfldocsuslt` as active **Odeon**, and the old standalone CRM project as inactive. The local configuration points at staging. The earlier empty searches were staging results, not evidence about production.

Read-only schema and record queries against Odeon found Chris's CRM contact and one lesson inquiry. The production contact is `e335ecf5-976b-4c3f-8b09-61d9acb1723f`; the lead is `b9d5e721-26ee-4494-afcc-a1413fe7dea9`, scoped to the default Headliner tenant.

Verified findings:

- Two outgoing emails titled `Re: Guitar Lessons` are recorded in `gmail_outreach`, each linked to the same lead and an existing `note_added` event. Sent timestamps are October 21 and October 23, 2026 in America/Los_Angeles (October 22 at 03:43:49 UTC and October 24 at 02:49:44 UTC). These two emails were captured, not lost in sync.
- The lead has eight note events in total. Its `payload.notes_history` is empty, but that is not a missing-note diagnosis: the lead detail endpoint reads `note_added` events separately.
- A manual note on October 27 says another follow-up email was sent "yesterday," suggesting an October 26 follow-up. No corresponding captured outreach row to this contact's address was returned. The provider message itself has not been checked, so this remains an inferred candidate for the reported missing email.
- The lead's current status is `processing`. A subsequent production read-only status-history query verified the transition from `contacted` to `processing` on October 24, 2026 at 02:50:13.833533 UTC, about 29 seconds after the second captured email and before the inferred October 26 follow-up. The current sync query and matcher accept only `new`, `contacted`, or `booked`. This establishes a concrete capture exclusion in the repository code for the candidate period, but the missing provider message and deployed application revision remain unverified; it is not yet an end-to-end proven diagnosis.
- The connected shared mailbox's `last_synced_at` was October 28, 2026 at 15:50:01 UTC, with no recorded error. Capture begins October 21, 2026 at 15:21:41 UTC; emails before that boundary are outside the configured capture window.
- Captured emails use `event_type = note_added`, and the detail panel deliberately excludes all `note_added` events from Activity. They belong in Notes under the present implementation, not Activity.

Next: verify the specific October 26 follow-up's provider metadata and deployed behavior before choosing a scoped capture fix or backfill. Status history and production identity are established; no need to ask the user to re-identify Chris. Production deployment configuration and deployed code version were not independently inspected in this checkpoint. A subsequent mailbox metadata read showed `last_synced_at` at October 28, 2026, 16:10:01.492839 UTC with no recorded error; a healthy cursor alone does not prove complete capture.

## Owner lifecycle clarification — October 28, 2026

Contact history must preserve emails from the lead stage; relevant correspondence must continue as lead-panel notes after enrollment for as long as the lead remains in Leads, independently of conversion automation. The enrolled lead's permanent exit from Leads is undecided; the proposed milestone is completion of Odeon and migration off Opus1. These are recorded requirements, not a recovery approval or automatic removal rule. This release implements the capture-eligibility fix below, not contact promotion or cross-directory history migration. Broader Odeon planning documents are intentionally outside this release.

The current sync skips unmatched messages before creating a receipt and advances the completed window with only a five-minute overlap. Correcting eligibility alone will not recover older skipped emails. Future validation must cover both Enrolling and won/enrolled history continuity without regressing status, plus a separately verified recovery path for the candidate message.

## Local capture fix — October 28, 2026

- Implemented shared `EMAIL_CAPTURE_STATUSES` in `/Users/brunowong/pulse/lib/gmail/rules.ts`, used by both the sync candidate query and matcher. Capture now includes `processing`, `won`, and legacy `enrolled` rows alongside the previous active statuses. Lost/spam/ghosted and win-back exclusions, tenant scoping, exact-address matching, bulk safeguards and ambiguity review remain intact.
- No SQL change is necessary: the existing `gmail_record_outreach` function inserts a contact-linked lead note independently of its guarded status transition. Disposable PostgreSQL execution verified each converted state with both Contacted and Booked decisions, retry deduplication, unchanged status and retained lead/contact linkage.
- Validation: 70 targeted Gmail, scheduler, conversation-display and Notes tests passed; targeted ESLint, TypeScript and the isolated PostgreSQL Gmail rehearsal passed. These checks do not prove hosted deployment or recover Chris's candidate message.
- Not deployed by this change. No hosted writes, live sync, provider requests, cursor resets or backfills were performed. Contact promotion and durable cross-directory historical display remain separate implementation work; no enrolled leads were hidden or removed.

## Read-only database checkpoint

Used the active Supabase connection's read-only SQL tool against the project referenced by the local CRM configuration. Verified relevant columns through `information_schema` first; no token or secret values were selected.

The following scoped searches returned no rows:

- CRM contacts with full name matching Chris Moon, followed by surname/full-name Moon variants.
- Person records with surname containing Moon.
- Lead intake payload name, full-name, parent-name or student-name fields containing Moon.

This does not establish that the person or email is absent from the intended live environment. A different spelling, a different linked contact name, or a different deployed project remains possible. Do not broaden into unrelated mailbox contents based on a name guess.

This staging-only identity block was resolved by the production lookup above.

## Verified code paths

- `/Users/brunowong/pulse/app/api/conversations/email/route.ts`: a successful Gmail send records `communications.email_sent` in the account audit trail, including the provider message ID. It does not immediately create a lead note/event. An audit receipt is not proof that a note was captured.
- `/Users/brunowong/pulse/lib/gmail/sync.ts`: automatic lead-note capture is a separate path. It reads sent mail within the connection's capture/sync window; queries lesson, tour and service inquiries using the shared capture statuses (previously only new/contacted/booked; locally fixed to include processing/won/legacy enrolled); skips messages with no recipients or more than five recipients; skips unmatched messages or empty captured bodies. Ambiguous candidate leads remain for review rather than being attached automatically.
- `/Users/brunowong/pulse/lib/gmail/rules.ts`: matching excludes win-back leads and leads created after the email was sent, and requires an email-address match. These are current eligibility rules, not a confirmed explanation for Chris's email.
- `/Users/brunowong/pulse/components/leads/LeadEmailSync.tsx` and `/Users/brunowong/pulse/app/api/leads/sync/route.ts`: the manual Sync button executes capture and writes records. It must not be used as a supposedly read-only diagnostic.

## Next read-only evidence required

1. Use the established tenant and lead/contact identity above to identify the specific email (sender mailbox, sent timestamp and subject/provider ID). A name alone is not a unique identity.
2. Confirm provider acceptance from the audit receipt and Sent message; do not resend or trigger sync.
3. Inspect only the relevant lead's intake type, status, creation timestamp, email and win-back metadata; compare against the capture rules.
4. Inspect connection capture bounds/cursor/error metadata and the matching outreach receipt's status/candidate IDs. Do not retrieve credentials or unrelated mailbox contents.
5. Compare any captured lead note/event with the detail-panel response and rendered timeline to separate capture, linkage and presentation failures.

The local lifecycle capture fix above is covered by synthetic and disposable-database tests. Do not automatically link ambiguous people or backfill Chris's candidate message without the remaining provider evidence. The scoped production records above are verified; provider evidence and deployed application/schema compatibility for a fix remain unverified.