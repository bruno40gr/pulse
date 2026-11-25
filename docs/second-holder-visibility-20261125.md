# Second holder visibility correction — November 25, 2026

Base: `152fa46`. The first release grouped saved account relationships but the
family table still rendered only person records. Account-only second holders
were absent from the table and normal profile view. Prior browser acceptance
covered the management dialog, not this missing normal-view rendering.

The correction renders deduplicated saved holder account summaries beneath the
family header, with saved phone/email details. The normal profile has an Account
holders section. Holder summaries have no person ID, recipient checkbox, or
inferred messaging permissions. Existing actual-person holder rows and selection
contracts remain unchanged. No account, payer or routing writes or migrations.

Validation: TypeScript passed; focused tests 45/45; full suite 1,124/1,141,
same 17 baseline failures (failure-name comparison); changed-file lint zero
errors/two existing warnings. Synthetic browsers at 1440px/390px explicitly
verify Alexandra in the family table and normal profile, her contact details,
and absence of a recipient-selection checkbox. Existing follow-up and management
dialog browser tests also pass. No authenticated production roster UI was used
as acceptance evidence.