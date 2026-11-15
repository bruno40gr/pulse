# Teacher experience preview — November 15, 2026

Entry: Beta → Staff → **Teacher experience · Preview**, or
`/odeon-demo?screen=teacher`. Existing Owner/Admin Beta access gates are unchanged;
this is not a teacher login or a production teacher permission boundary.

## Scope

- Mobile calendar: no pointer drawing on narrow screens or touch pointers. Use
  **Add booking**; existing booking inspection and keyboard activation remain.
- Mobile calendar filters are inside the shared accessible slide panel, including
  staff, room, service, unavailable time and the week-resource selector. Date
  navigation and both tab sets remain outside. Desktop filtering is unchanged.
- Teacher mockup: day/week agenda and roster from preview records, participant
  attendance controls, lesson-note tasks, family-message drafts, configured
  teaching hours and availability proposals. Desktop uses two columns; mobile
  stacks the same components.
- All teacher edits are component-local and disappear on exit/reload. Nothing is
  sent, no API mutations are made, and no shared sample records are changed.
  The selected-period task queue is not an overdue/due-date calculation. Live
  inbox, note publication and approval submission are not connected.

## Product direction

The concrete task need is a teacher's daily follow-through, not another polished
admin calendar. Humans own teaching judgment, notes, family relationships and
availability exceptions. Agents may later collect missing actions and prepare
drafts; attendance evidence, family communication and schedule changes need
authoritative records and policy-enforced actions. Preserve the approval-first
direction in `docs/Odeon-AI-vision.md`.

Before live use: server-resolved teacher identity/assignments, roster and family
visibility permissions, auditable per-participant attendance, lesson-linked notes
with explicit audience, authorized communication threads/delivery, and effective-
dated availability requests with conflict checks and office approval. Do not
mistake the preview selector for authorization or temporary proposals for school
availability. Further cosmetic iteration should be deferred until teachers review
the daily workflow; it displaces reliable rescheduling and live permission work.

## Validation

- 1,099/1,099 academy/security tests passed.
- Production build passed (Next.js 15.5.29), TypeScript check and targeted ESLint
  passed; no dependency or migration changes.
- `beta-mobile-teacher-browser.cjs`: 390px and 1440px, calendar filter controls,
  focus restoration, touch/narrow drawing disabled, explicit Add booking,
  teacher schedule/tasks/notes/drafts/availability validation, no API writes or
  sample-record changes, no browser errors or horizontal page overflow.
- Existing desktop calendar controls/profile/booking regression and desktop/mobile
  Beta navigation regressions passed. Mobile-specific filter checks now reside
  in the new browser script rather than the desktop toolbar geometry test.
- Screenshots and command logs saved under `/tmp/odeon-{teacher,mobile-teacher}*`.
  Local preview validation does not establish hosted deployment readiness.