# Notes and follow-ups review

Branch: `feature/notes-follow-ups-prototype`, based on main `edcb85f`.
Review route: `/dashboard/design/notes-follow-ups`.

## Review scope

This is an additive mockup, not a Notes redesign. Production Notes is unchanged.
The review mirrors its existing subtitle, date buttons, inline sticky composer,
bounded 390px cards, pinning, editing, replies, author/date metadata, and done
control. It intentionally has no Cards/List switch, new-note modal, or replacement
person workspace. Local replies only illustrate the existing control; production
conversation/mention behavior and permissions are not being reimplemented.

## Sticky interaction refinement

Clicking a sticky enters inline editing. Clicking outside, or moving keyboard
focus outside, saves its text locally; there are no sticky Save/Cancel buttons.
Focus mixes the sticky's existing color with a subtle 6% darker tint (not a
status color). Per the supplied reference, only tasks show the green outlined
**Mark done** text button; informational notes have no completion control.

Creation and inline editing share one mention-driven pattern:
- Without an eligible staff mention, the composer has **Add as note** and existing
  stickies retain save-on-blur. A bare @, unknown name or client-only mention
  does not expose task actions.
- An eligible staff mention reveals bottom actions: primary **Create a task** on
  the composer, primary **Convert to task** on an existing sticky, with secondary
  **Keep as note**. Removing the mention hides the actions.
- Keep as note saves the mention and content, with no assignment. Real mention
  notifications remain a future production integration, not a local mockup claim.
- Conversion updates the same ID. Text, color, pin state, privacy and replies stay.
  The mentioned staff member preselects Owner; a related client remains separate.
- Task details use **Description**, populated from the sticky body (not its title).
  The original sticky remains intact. Description is optional in the local stored
  model for backward compatibility, and required in the task form.
- **Due date** is second, with Today, Tomorrow, 2 days and Specific date shortcuts.
  Related to search and Owner follow. Date arithmetic uses local calendar days.

Cards use softer versions of the existing sticky colors. Saved tasks have an
owner-avatar/name, formatted date and due-status row; clicking this row opens
the task-details SlidePanel. Plain notes have only their content and
Reply/author/time footer. Blue mention highlighting is shown in the composer.
Avatars are fictional initials, not authenticated profile photos.

The Tasks dropdown retains Open tasks, Assigned to me, Today + overdue, Upcoming
and Completed tasks. Completed tasks remain available even when Hide done is on.
Related to searches fictional leads/contacts; unmatched free text must be chosen
from results or cleared. Existing saved assignments are preserved on reopening.

Date buttons still refer to note creation, not task due date. Counts in the task
selector summarize all fixture tasks; the date buttons can further narrow them.
For a daily task check, use All dates plus Today + overdue; use Assigned to me
for personal responsibility. No notifications or automatic messages are mocked.

All people and notes are fictional. Changes live only in browser localStorage
under `pulse_notes_follow_ups_review_v1`, not the live notes store. Clear that key
to restore fixtures. No domain writes, migrations or reminder integration.

## Odeon boundary / eventual integration contract

Do not modify ContactSlidePanel, LeadDetailPanel, shared NotesSection or Odeon's
student workspace for this experiment. Related people appear only as an optional
task field; production profile projections remain a future integration concern.

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
- Review the minimal task filter and assignment defaults before implementation.

No projects, subtasks, boards, dependencies, recurring engines or workload tools.

## Validation

Unit tests: `node --test scripts/security/notes-follow-ups-prototype.test.cjs`.
Browser: `node scripts/security/notes-follow-ups-prototype-browser.cjs` with
`NOTES_REVIEW_URL` and optionally `PLAYWRIGHT_MODULE` for the local review server.
No production verification is implied by fictional review tests.