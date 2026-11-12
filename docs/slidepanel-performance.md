# Slidepanel performance: evidence and rules

## Measured production evidence

One lead-detail browser capture supplied on November 12, 2026 shows 2.85 seconds
total: 2.84 seconds waiting for the response, 4.28 ms queueing and 1.60 ms download.
This is one sample, not a percentile or proof of a particular database bottleneck.

The instrumented production lead GET at 19:12 UTC on November 12 recorded 2334 ms
handler time: access 1948 ms, record 111 ms, activity 282 ms, notes 255 ms and
authors 103 ms. Access includes identity enrichment; this sample does not isolate
each individual access subquery or prove a contact-specific delay.

## Targeted access optimization

- Reuse the full membership row already selected within the current resolution;
  retain tenant, active-status, legacy-access and ambiguous-account checks.
- Resolve role and its permission mappings concurrently, but require a valid
  tenant-scoped role and successful permission queries before granting access.
- Lead GET uses the same tenant authorization without the unused viewer-name and
  instructor enrichment. Note author identity and editability remain verified.
  PATCH retains full identity enrichment for mutation attribution.
- Request-context reuse is keyed by Request object and tenant only; no permission
  data is cached across requests. No middleware checks are bypassed.
- Contacts using membership authorization benefit from the shared resolver;
  legacy contact authorization behavior is unchanged, not broadened.

This removes queries/serial waits rather than adding requests or hiding a delay.
Production before/after improvement still requires observed post-deploy timings.

## Current data flow

- Leads opens its panel shell immediately, but hides the detail component behind
  a skeleton until the complete detail response arrives. Each opening refetches.
  The handler resolves access and staff identity, then queries the record, recent
  activity and complete note history concurrently, then resolves note authors.
- Contacts is not identical: ordinary list contacts open from already-loaded row
  data. Staff contacts and instructor navigation await the detail endpoint before
  selecting the contact; deep links also fetch detail. The contact endpoint queries
  the joined person record, then authorizes its tenant, then looks up instructor
  status and, when applicable, active students. A schema-compatibility failure may
  add a second record query. Diagnostics preserve this ordering, not endorse it.
- The endpoints use different access helpers. Do not unify them by removing
  membership, permission, tenant, role or legacy/demo checks.

## Diagnostic contract

Both GET endpoints emit private/no-store responses with Server-Timing and an
X-Request-Id. Static stage names and millisecond durations contain no contact data.
Existing GET queries and response bodies are unchanged. No polling, retries,
prefetching, database writes or external telemetry is introduced.

Leads: access, optional job lookup, record, activity, notes, optional authors.
Contacts: record, optional legacy_record, access, instructor, optional students.
Total is handler wall time, not the sum of concurrent stages. It excludes upstream
middleware, cold startup before handler execution and network transport. Compare
it with browser waiting time rather than treating it as complete request latency.

## Rules for subsequent fixes

1. Open the panel shell and identify the selected record promptly. Do not label a
   loading skeleton as a backend speed improvement.
2. Separate core fields from optional activity/enrichment only when measured
   benefit justifies extra authenticated requests and invocation cost.
3. Never enable edits against partial or unverified detail. Preserve full note
   history, author attribution, communication routing and consent checks.
4. Any future reuse must be scoped to tenant, staff identity and record, bounded
   in lifetime and invalidated after mutations and identity/tenant transitions.
   Ignore obsolete requests after selection changes or close; avoid showing the
   previous contact when a new request fails.
5. Keep independent work concurrent after authorization. Optimize query shape or
   remove unnecessary identity/enrichment work only with security regressions.
6. No per-row prefetch, keep-warm traffic, faster polling or permission caching
   across server requests. Compare request counts as well as visible latency.

## Rollout gate

Ship diagnostic-only changes separately from the pending list/account optimizations.
Verify the deployed commit and ready status before collecting one authorized lead
and one contact interaction. Do not claim a production improvement from local
synthetic tests or assume a successful push proves successful deployment.

## Follow-up after the first access optimization

Production requests on November 12, 2026 still took 1,316–1,775 ms in the
handler, including 942–1,179 ms resolving access. The browser reported 2.58 s
waiting. This is not an instant detail response; middleware/startup/transport
remain outside the handler timer.

The follow-up combines tenant-scoped role and permission-key loading using the
existing foreign keys, eliminating the separate mapping and permission queries.
Missing or malformed embedded permissions fail closed. Membership status,
legacy eligibility, tenant selection and permission enforcement remain unchanged.

Opening a loaded lead now immediately renders a clearly labelled read-only
preview from its existing list row. It does not fabricate detail, fetch notes
separately, prefetch rows or permit edits/messages before the fresh detail arrives.
Deep links without a list row retain the loading fallback. Existing request-ID
guards discard late results after close or selection changes.

The intercepted local browser check held the detail response open and measured
73 ms to preview, one GET per opening, no writes and no late-response reopening.
This is a local UI measurement, not evidence of improved production server time.