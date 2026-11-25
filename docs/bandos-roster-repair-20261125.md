# BandOS roster regression — November 25, 2026

## Earlier implementation

- `5d85c0e`: merge explicit band memberships into the enrollment roster.
- `9ceaa93`: support multiple instruments per member.
- `28bdd57` / `ae5fecd`: inline/shared multi-select dropdown.

## Verified cause

Read-only inspection of production found SunKast's Harper Cole, Brooks Henderson,
and Breannah Gonzalez attendance-derived band enrollments marked ended with
`superseded_by_subscription_snapshot = nov19-subscription-repair-v1`. Each has
an active replacement with the matching `reconciliation_run`, instrument `Band`,
and service type `group`, but without the reviewed ensemble name/instrument.
The band-only enrollment query omitted those replacements; only Rhett Walde's
explicit membership survived. The old review records four members plus Bruno
Wong as coach, not five student memberships.

## Repair

- Resolve reviewed ensemble metadata onto the active replacement only when the
  student and reconciliation run match and both replacement and band identity
  are unambiguous. Do not reactivate ended records or infer from names.
- Preserve top-level and imported ended status, explicit removals, tenant scope,
  saved instruments (including an empty selection), and explicit memberships.
- Show coaches alongside members in the roster, without duplicate people or
  destructive student actions on coach-only rows. Keep membership/communications
  semantics unchanged.
- Save all selected instruments on the exact current band enrollment; never
  fall back to an unrelated first enrollment. Removal resolves that same current
  enrollment. Membership-only changes no longer clear explicit instruments.
- No production writes performed. Changes require deployment.

## Validation

- TypeScript `npx tsc --noEmit`: passed.
- Targeted ESLint and `git diff --check`: passed.
- `node --test scripts/security/band*.test.cjs scripts/security/current-enrollment.test.cjs`:
  73 passed, zero failed.
- Synthetic browser acceptance at 1440px and 390px: five-person roster including
  coach, multi-select PATCH and reload, Escape dismissal, no page overflow;
  no live API writes. Screenshots: `/tmp/band-roster-1440.png` and
  `/tmp/band-roster-390.png`.
- Production deployment/browser behavior has not been verified after this fix.

## Whole-workspace audit and draft visibility follow-up

The fix is not SunKast-specific. Production read-only reconciliation audit found
14 retired ensemble rows with current Band replacements across six ensembles:
AJ Athena Band (1), Anomaly Syndrome (2), La Paz (2), ManiaC (3), SunKast (3),
and Young Thursday Band (3). Two New Thursday Band rows have no current Band
replacement and are not resurrected. A separate `Bass 101` row remains an
instrument track rather than an invented band; Rhett's reviewed explicit SunKast
membership is preserved. Existing external/archived profile restrictions remain.

The resolver now reuses `knownBandNames` / `bandNameFor`, including preference
for reviewed ensemble labels over unrelated session names (e.g. ManiaC versus
Songwriting - Ben & Landon). Tests cover multiple ensembles together, unrelated
private lessons, and rejection of instrument-track-only identity.

The precise shared dropdown implementation is `ae5fecd`; it is retained intact.
`28bdd57` introduced native multi-select before that shared dropdown upgrade.
No replacement selector or parallel band creation form was built.

Draft history: `2be10df` introduced saved draft profiles; `9f4472c` introduced
the creation wizard; `bf05621` and `b33f990` contain the persisted workflow-draft
transport. Production has the legacy `New band` draft profile and zero rows in
`band_creation_drafts` for the reviewed tenant. Draft profiles were mislabeled
Forming, while the separate Band drafts section appeared only for workflow
drafts. Both forms are now discoverable under Band drafts, legacy profiles keep
their Draft label, and Continue uses their existing profile editor. Workflow
drafts keep their existing save/resume transport. An empty workflow table says
No unfinished wizard drafts rather than claiming no band drafts exist.

Follow-up validation: 75 focused tests passed; TypeScript, targeted ESLint and
diff checks passed. Browser acceptance at 1440px and 390px now also exercises
legacy draft access and wizard Save & close / resume / save, plus the original
shared instrument dropdown's multi-selection persistence. All browser APIs were
synthetic. No production data was changed; deployment remains outstanding.