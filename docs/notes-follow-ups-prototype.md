# Notes and follow-ups review

Branch: `feature/notes-follow-ups-prototype`, based on main `edcb85f`.
Review route: `/dashboard/design/notes-follow-ups`.

## Review scope

Notes is the home, not a new Tasks destination. Cards and List project the same
items. A sticky stays informational unless a staff member explicitly chooses
Make a follow-up, names an action, selects an owner and sets a due date. Linking
one lead or contact is optional; the record type remains explicit.

Color and original note text remain after conversion. Follow-up title and original
note title are distinct. Conversion updates the existing item ID rather than
creating an independently editable copy. Today + overdue contains only open,
actionable items. Notes without an action do not acquire a due date or owner.
Completed items can be reopened. Person preview includes completed context.

All people and notes are fictional. Changes and Cards/List preference live only
in browser localStorage under `pulse_notes_follow_ups_review_v1`, not the live
notes store. Clear that key to restore fixtures. No domain APIs, migrations,
messages, production note conversion, or existing first-lead-reminder integration.
Layout selection is browser-local here, not an authenticated staff preference.

## Odeon boundary / eventual integration contract

Do not modify ContactSlidePanel, LeadDetailPanel, shared NotesSection or Odeon's
student workspace for this experiment. A fictional related-person modal shows
the intended projection without establishing another profile implementation.

Future integration should request one canonical note/action by ID and project it
in Notes and its related profile. A note may carry optional actionable metadata:
action title, due calendar date, owner membership, completion timestamp and a
typed related reference `{ kind: 'lead' | 'contact', id }`. No name matching.
Assignments and related records are tenant-local; lead/contact identity and staff
ownership remain separate concepts. One completion updates every projection.

Before production integration:
- Confirm the canonical record/schema and transactional writes with Odeon.
- Enforce staff permissions, tenant isolation, authorship and note privacy on the
  server. Converting a private note must not make it visible through a profile,
  assignment or notification; require an explicit sharing decision where needed.
- Preserve original note text, color, replies and history. Audit conversion,
  assignment, completion and rescheduling; protect concurrent edits.
- Decide how existing lead payload reminders migrate without duplicate actions.
- Keep sticky note date distinct from due date; define tenant calendar timezone.
- Add per-membership view preference persistence and accessible production search.

No projects, subtasks, boards, dependencies, recurring engines or workload tools.

## Validation

Unit tests: `node --test scripts/security/notes-follow-ups-prototype.test.cjs`.
Browser: `node scripts/security/notes-follow-ups-prototype-browser.cjs` with
`NOTES_REVIEW_URL` and optionally `PLAYWRIGHT_MODULE` for the local review server.
No production verification is implied by fictional review tests.