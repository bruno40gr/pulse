# Subscription and lesson summary consistency — November 22, 2026

Status: deployed November 22, 2026 from an isolated release. Existing unrelated WIP is retained.

## Production release — November 22, 2026

- Promoted deployment `dpl_9RET9mWoyHGsYLX6FnkKhZfqqT9s` to the canonical
  `app.headlinerma.com` domain; Vercel reports Ready.
- Isolated source: `/private/tmp/pulse-card-summary-release-20261122`, based on
  the previously live `/private/tmp/pulse-ui-rhythm-release-20261120` snapshot.
  Its `card-summary-release-files.json` records 13 allowlisted overlay files and
  their hashes. No unrelated checkout changes or scheduling snapshot changes
  were included. No migrations, imports, commit, or push were performed.
- Validation: 40 focused tests, TypeScript, targeted lint, exact file allowlist,
  and local synthetic browser workflows at 1440px/390px passed. Vercel production
  build and production configuration checks passed. Local production builds were
  blocked first by missing environment variables, then Google Fonts URL parsing;
  no font workaround or synthetic credentials were deployed.
- Post-promotion: canonical login returned HTTP 200; unauthenticated Contacts
  redirected to login (HTTP 307). The synthetic browser harness deliberately
  refuses non-local origins, so no authenticated production browser acceptance
  is claimed. Beta reschedule sidebar visual acceptance remains open.
- Live enrollment-level mapping remains unresolved; unknown levels stay absent.
- Rollback target: `dpl_GVR1rDTfC8DsJS3qqjB8vyk8iM8q` (the prior live release).
- Evidence: `/private/tmp/pulse-card-release-{tests,types,lint,browser,deploy,promote}.log`
  and `/private/tmp/pulse-card-canonical-inspect.log`.

## Revised hierarchy: level included

The subsequent approved grouping supersedes the single-line service order below:

- Subscription: bold H3 **Voice • Level 2**, then Private • 30 min, then teacher.
  Keep it subordinate to the student heading; strengthen weight, not heading size.
- Lesson list: prominent date/time with (Private • 30 min) in regular secondary
  styling, then Harper • Guitar • Level 2, then teacher/status. Text may wrap.
- Reschedule/makeup sidebar: instrument/level followed by format/duration, with
  service context shown once above original/destination details.
- Use enrollment levels where present, or explicit Level N wording in legacy
  plans. Never infer Level 1 from missing data. The live Contacts response does
  not expose a confirmed enrollment-level source yet; that data integration is
  still open. A synthetic fixture displaying Level 2 is not live-data evidence.

Updated domain coverage: 40 focused tests passed, along with TypeScript and
targeted lint. Evidence: `/private/tmp/pulse-card-level-tests.log`.

- Reuse the existing SubscriptionCard and LessonCard shells. Shared content lives
  in `/Users/brunowong/pulse/components/ui/LessonSummary.tsx`, backed by
  `/Users/brunowong/pulse/lib/lesson-summary.ts`.
- Service identity order is Instrument • Format • Duration, for example
  Voice • Private • 30 min. Formats are Private, Semi-private and Group.
- Prefer an explicit recognized format; fall back to recognizable plan wording
  for legacy records. Do not invent a format when neither source identifies it.
- Live subscriptions omit the redundant plan-name line. Existing schedule,
  instructor, payment placeholders and subscription actions remain unchanged.
- Subscriptions lead with service identity. Lesson lists lead with occurrence
  date/time, followed by student and service identity, then instructor/status.
- Reschedule summaries show student/service context once, original date/teacher,
  then destination date/time before destination teacher. No scheduling mutation
  or booking-policy changes are part of this presentation pass.
- Edit contact separates family management from contact fields. Cancel and panel
  close use the shared app Modal only when editable fields have unsaved changes.
  Unchanged or reverted fields exit directly; Keep editing preserves the draft.
  Already-saved family mutations are not rolled back by discarding contact edits.

Validation: 39 focused tests, TypeScript, targeted lint and whitespace checks
passed. Local synthetic browser workflows at 1440px and 390px verified the live
subscription title, absent duplicate plan text, family-section gap, clean/reverted
Cancel, Keep editing and Discard, without native dialogs. API IO was intercepted;
this is not authenticated production acceptance. Browser coverage does not yet
prove the changed Beta reschedule sidebar's visual layout.

Evidence: `/private/tmp/pulse-card-consistency-{tests,browser}.log` and
`/private/tmp/pulse-card-consistency-types.log`.
No deployment, migration, customer writes, commit or push in this pass.
