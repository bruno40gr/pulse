# Synthetic funded-cases test data

These records are entirely fictional and intended only for Charterflow/Pulse testing. They do not represent real students, families, funding organizations, authorizations, or contact details. The CSV is an optional test fixture for populating fictional students; it does not prescribe a production workflow.

## Safety characteristics

- Every student first name begins with `Demo` so test records are easy to identify.
- Stable IDs begin with `CF-DEMO-`.
- All email addresses use the reserved `example.com` domain.
- Phone numbers use the fictional North American `202-555-01xx` range.
- The `instructor` column is intentionally blank so importing the file does not create synthetic staff/instructor records.
- No funded students or invoices are created merely by importing the CSV. The import creates student/contact, family account, and enrollment records; funding assignments are created separately in the **Funding** workspace.

## Optional test-fixture setup

1. Open **Contacts**.
2. Choose **Import CSV**.
3. Upload `docs/test-data/funded-cases-synthetic-students.csv`.
4. Confirm the suggested mappings. The headers intentionally use the importer's canonical field names.
5. Keep `external_id` mapped so rerunning the same file updates the synthetic records instead of duplicating them.
6. Complete the import, then open **Funding** and choose **Add funded student**.

The file contains 12 students across 11 family/account arrangements. Demo Maya Testwood and Demo Leo Testwood intentionally share one account holder to exercise sibling/family behavior. Demo Marcus Ellis is an adult student with no separate account-holder fields.

## Funding program setup

Use **Funding → Funding programs → Add funding program** to choose an organization from the product catalog. Use **Don’t see your organization? Request it** for missing entities. A request does not create a selectable production program until product review is complete.

Tenant admins may add tenant-specific contacts, identifiers, notes, and student exceptions. They do not author portal URLs, public instructions, or global payment rules.

Program-level values (submission route, invoice cadence, payment method, program contacts) are reusable defaults. A funded student's case only shows an override when it differs from the program default. Program-level contacts cover the financial agent, billing, and vendor representative; the student case carries the assigned coordinator and family contact.

## Funded Students and Contacts surfaces

- **Funded Students** opens on the **All students** tab and shows no summary tiles. Selecting a row opens the student's contact record directly on the **Funding Program** tab.
- Billing and invoices live on the contact record's **Billing** tab. The embedded Funding Program tab deliberately omits them so the same data is never shown twice.
- **Suggested next step** is a read-only, prescriptive checklist derived from the student's outstanding funding details; it is no longer an editable dropdown.
- The **Contacts** table shows a **Funded** badge for any contact with an active funded-student case. The badge comes from one bulk membership lookup per page load, not a request per row.
- Funding program guidance records its official source and review date. Open the linked source on any vendor-setup step to read the primary document.

Apply funding migrations through `scripts/migration-024-account-people-of-contact.sql` before testing funded-student contact assignment. Re-apply it if it was applied before this revision: its validation triggers previously referenced the optional `student_accounts` table, which fails every `account_contacts` insert on schemas that do not have that table. The onboarding flow can reuse an existing person of contact from the selected student's customer account or create one inline and assign it as a family or coordinator contact.

## Test scenario matrix

All dates below are examples for the October 2026 test cycle.

| Student | Scenario | Organization | Suggested funding details | Expected result |
|---|---|---|---|---|
| Demo Maya Testwood | Minimal assignment, then incremental completion | ACE FMS | First assign only the student and program. Then add service `Weekly private piano instruction`, code `MUSIC-PIANO-30`, authorization `DEMO-1001`, authorization dates `2026-09-01`–`2026-12-31`, amount/cap `$480`, and coverage `100%`. | Appears immediately under **Funded students** with **Action needed**, then becomes complete without placeholder values. |
| Demo Leo Testwood | Existing program reuse and sibling account | ACE FMS | Service `Youth rock band participation`; code `MUSIC-BAND-01`; authorization `DEMO-1002`; amount/cap `$325`; coverage `100%` | Reuses the selected catalog program rather than creating duplicate organization configuration; confirms sibling students remain separate funding relationships. |
| Demo Sofia Calder | Blocked onboarding | Alta California Regional Center | Service `Weekly private voice instruction`; lifecycle `Blocked`; blocker `Authorization pending`; waiting on `Funder`; next step `Request the active authorization.` | Appears as a blocked funding relationship without confusing the blocker with invoice payment status. |
| Demo Amir Bennett | Multi-role organization | Mains'l | Service `Weekly private drum instruction`; authorization `DEMO-2048`; coverage `100%`; waiting on `Vendor` | Shows the organization’s role-backed program while keeping student authorization data on the case. |
| Demo Evelyn Park | Family-owned task | Aveanna | Service `Beginning semi-private strings`; authorization `DEMO-3301`; coverage `100%`; waiting on `Family`; next step `Ask the family to complete the assigned task.` | Exercises the Family owner without changing shared product guidance. |
| Demo Noah Rivera | Partial funding | ACE FMS | Service `Youth rock band participation`; authorized amount `$450`; coverage cap `$337.50`; coverage `75%`; student-specific instruction `Family is responsible for the remaining 25%.` | Confirms student-specific coverage and exceptions remain on the funding relationship rather than changing the shared program. |
| Demo Zoe Martin | Archive and reopen | Alta California Regional Center | First case authorization `DEMO-OLD-77`; archive it; then create a new case using authorization `DEMO-NEW-91` | Archived case disappears from the active list but remains retrievable; replacement active case succeeds. |
| Demo Caleb Brooks | Duplicate prevention | Public Partnerships | Create one active case, then try to create another active case for the same student and organization | Second concurrent active case is rejected. |
| Demo Luna Patel | Invoice rejection and resubmission | ACE FMS | Use a `$520` invoice; reject with evidence `Authorization code did not match the payer record.`; then return it to Pending | Rejection requires evidence, preserves outstanding value, and records status/audit history. |
| Demo Theo Nguyen | Paid invoice reconciliation | Public Partnerships | Use a `$360` invoice, move it to Pending, then Paid with the actual test date | Paid amount becomes `$360`, outstanding becomes `$0`, and the case reconciles to Paid. |
| Demo Isla Johnson | Prospect filtering | Do not add as a funded student initially | Search Contacts for `prospects with piano` | Exercises AI/contact filtering while proving the imported dataset is useful outside the Funding workspace. |
| Demo Marcus Ellis | Adult/self-account student | Accura FMS | Service `Adult voice coaching`; no separate family contact | Confirms onboarding options handle a student whose account falls back to the student's own identity. |

## Invoice records versus invoice documents

The current application has an invoice-creation API and a complete status/history workflow, but the UI does not yet expose a **Create invoice** form and does not generate a PDF. Until that UI is implemented, use existing seeded/verified invoices to test status transitions, or invoke the API manually.

Example request body for a case invoice:

```json
{
  "invoice_number": "DEMO-2026-1001",
  "amount": 520,
  "status": "pending",
  "service_period_start": "2026-10-01",
  "service_period_end": "2026-10-31",
  "issued_on": "2026-10-31",
  "due_on": "2026-11-30"
}
```

Send it as an authenticated `POST` to:

```text
/api/funding/cases/{case-id}/invoices?tenant={tenant-id}
```

## Useful AI/contact search checks

If you import the fixture, try queries such as:

- `active funded-test students`
- `piano students with Monday lessons`
- `band students who were absent`
- `prospects with piano`
- `students in the Testwood family`
- `active students with no student email`
- `voice students with Tuesday lessons`

## Cleanup guidance

This file is safe to import repeatedly because `external_id` is stable, but the product does not currently provide a bulk-delete-by-tag control. Import it only into an environment where visibly labeled demo records are acceptable. To remove the records later, locate contacts with the `funded-test` tag or `CF-DEMO-` external ID and delete them using an approved cleanup process.