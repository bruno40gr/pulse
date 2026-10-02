# Synthetic funded-cases test data

These records are entirely fictional and intended only for Charterflow/Pulse testing. They do not represent real students, families, funding organizations, authorizations, or contact details.

## Safety characteristics

- Every student first name begins with `Demo` so test records are easy to identify.
- Stable IDs begin with `CF-DEMO-`.
- All email addresses use the reserved `example.com` domain.
- Phone numbers use the fictional North American `202-555-01xx` range.
- The `instructor` column is intentionally blank so importing the file does not create synthetic staff/instructor records.
- No funded cases or invoices are created merely by importing the CSV. The import creates student/contact, family account, and enrollment records; funded cases are created separately in the Funded Cases workspace.

## Import instructions

1. Open **Contacts**.
2. Choose **Import CSV**.
3. Upload `docs/test-data/funded-cases-synthetic-students.csv`.
4. Confirm the suggested mappings. The headers intentionally use the importer's canonical field names.
5. Keep `external_id` mapped so rerunning the same file updates the synthetic records instead of duplicating them.
6. Complete the import, then open **Funded Cases** and choose **New funded case**.

The file contains 12 students across 11 family/account arrangements. Demo Maya Testwood and Demo Leo Testwood intentionally share one account holder to exercise sibling/family behavior. Demo Marcus Ellis is an adult student with no separate account-holder fields.

## Suggested fictional funding organizations

Create these organizations through the funded-case onboarding form as needed. Reuse them for later students rather than creating duplicates.

### Northstar Family Management Services

- Organization type: `fms`
- Program name: `Participant-directed music services`
- Recipient routing: `portal_file_upload`
- Invoice cadence: `Monthly`
- Payment method: `Direct deposit`
- Profile instructions: `Upload one invoice per student and include the authorization reference and service period.`
- Contact: `Demo Nora Fields`, `Vendor support`, `nora.fields@example.com`, `202-555-0151`

### Riverbend Charter Academy

- Organization type: `charter`
- Program name: `Enrichment purchase order program`
- Recipient routing: `portal_manual_entry`
- Invoice cadence: `Monthly after attendance confirmation`
- Payment method: `ACH`
- Profile instructions: `Confirm attendance and use the active purchase order on every invoice.`
- Contact: `Demo Adrian Moss`, `Vendor coordinator`, `adrian.moss@example.com`, `202-555-0152`

### Evergreen Regional Services

- Organization type: `regional_center`
- Program name: `Individual music instruction`
- Recipient routing: `direct_to_fms`
- Invoice cadence: `Monthly in arrears`
- Payment method: `Direct deposit`
- Profile instructions: `Submit authorized service units with the assigned service code.`
- Contact: `Demo Priya Shah`, `Service coordinator`, `priya.shah@example.com`, `202-555-0153`

### FamilyBridge Supports

- Organization type: `fms`
- Program name: `Family-routed reimbursement services`
- Recipient routing: `family_routed`
- Invoice cadence: `Monthly`
- Payment method: `Family reimbursement`
- Profile instructions: `Send the invoice to the family contact for approval before submission.`
- Contact: `Demo Owen Reed`, `Family liaison`, `owen.reed@example.com`, `202-555-0154`

## Test scenario matrix

All dates below are examples for the October 2026 test cycle.

| Student | Scenario | Organization | Suggested case values | Expected result |
|---|---|---|---|---|
| Demo Maya Testwood | New organization and first profile | Northstar Family Management Services | Service `Weekly private piano instruction`; code `MUSIC-PIANO-30`; authorization `NSFMS-1001`; authorization dates `2026-09-01`–`2026-12-31`; amount/cap `$480`; coverage `100%`; lifecycle `Active`; next step `Prepare October invoice.` | Creates the organization, profile v1, organization contact, compatibility payer link, and active funded case. |
| Demo Leo Testwood | Existing organization/profile reuse and sibling account | Northstar Family Management Services | Service `Youth rock band participation`; code `MUSIC-BAND-01`; authorization `NSFMS-1002`; amount/cap `$325`; coverage `100%` | Reuses Northstar rather than creating a duplicate organization; confirms sibling students remain separate funded cases. |
| Demo Sofia Calder | Blocked onboarding | Riverbend Charter Academy | Service `Weekly private voice instruction`; code `ENRICH-VOICE`; lifecycle `Blocked`; blocker `Authorization pending`; waiting on `Funder`; next step `Request the active purchase order from the charter.` | Appears as a blocked case without confusing the blocker with invoice payment status. |
| Demo Amir Bennett | Regional-service workflow | Evergreen Regional Services | Service `Weekly private drum instruction`; code `SRV-DRUM-45`; authorization `EVR-2048`; coverage `100%`; waiting on `Vendor` | Creates a regional-services case using a different routing and cadence profile. |
| Demo Evelyn Park | Family-routed workflow | FamilyBridge Supports | Service `Beginning semi-private strings`; code `STRINGS-BEGIN`; authorization `FBS-3301`; coverage `100%`; waiting on `Family`; next step `Send the draft invoice to the family for approval.` | Exercises the Family owner and family-routed profile. |
| Demo Noah Rivera | Partial funding | Northstar Family Management Services | Service `Youth rock band participation`; code `MUSIC-BAND-01`; authorized amount `$450`; coverage cap `$337.50`; coverage `75%`; case instruction `Family is responsible for the remaining 25%.` | Confirms student-specific coverage and exceptions remain on the case rather than changing the shared organization profile. |
| Demo Zoe Martin | Archive and reopen | Riverbend Charter Academy | First case authorization `RBCA-OLD-77`; archive it; then create a new case using authorization `RBCA-NEW-91` | Archived case disappears from the active list but remains retrievable; replacement active case succeeds. |
| Demo Caleb Brooks | Duplicate prevention | Evergreen Regional Services | Create one active case, then try to create another active case for the same student and organization | Second concurrent active case is rejected. |
| Demo Luna Patel | Invoice rejection and resubmission | Northstar Family Management Services | Use a `$520` invoice; reject with evidence `Authorization code did not match the payer record.`; then return it to Pending | Rejection requires evidence, preserves outstanding value, and records status/audit history. |
| Demo Theo Nguyen | Paid invoice reconciliation | Evergreen Regional Services | Use a `$360` invoice, move it to Pending, then Paid with the actual test date | Paid amount becomes `$360`, outstanding becomes `$0`, and the case reconciles to Paid. |
| Demo Isla Johnson | Prospect filtering | Do not create a funded case initially | Search Contacts for `prospects with piano` | Exercises AI/contact filtering while proving the imported dataset is useful outside the funded-case workspace. |
| Demo Marcus Ellis | Adult/self-account student | FamilyBridge Supports or a new fictional organization | Service `Adult voice coaching`; no separate family contact | Confirms onboarding options handle a student whose account falls back to the student's own identity. |

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

After importing, try queries such as:

- `active funded-test students`
- `piano students with Monday lessons`
- `band students who were absent`
- `prospects with piano`
- `students in the Testwood family`
- `active students with no student email`
- `voice students with Tuesday lessons`

## Cleanup guidance

This file is safe to import repeatedly because `external_id` is stable, but the product does not currently provide a bulk-delete-by-tag control. Import it only into an environment where visibly labeled demo records are acceptable. To remove the records later, locate contacts with the `funded-test` tag or `CF-DEMO-` external ID and delete them using an approved cleanup process.