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

Only task-specific affordances are new:
- Selecting an @mention in the existing sticky composer reveals **Make a task**.
  It saves that sticky and opens the task modal directly. Mentioning alone does
  not create a task. Fictional lead/contact mentions preselect Related to; staff
  mentions preselect Owner. First mention of each kind wins for a new task;
  saved task choices are preserved when reopening. Production mentions stay staff-only.
- **Make a task** on a note opens action title, owner, due date and optional related
  lead/contact. The note's original title, text, color and ID remain unchanged.
- Action is multiline. Related to searches the fictional lead/contact directory;
  choose a result rather than saving unmatched free text. Clearing search unlinks it.
- **Task details** reopens those fields for assignment or rescheduling.
- A compact task line carries its owner and due state on the same sticky.
- One **Tasks** dropdown adds Open tasks, Assigned to me, Today + overdue,
  Upcoming and Completed tasks, with counts. All notes is the default.
- Existing Mark done / reopen works on the same item. Completed tasks remain
  available through their filter even when Hide done is enabled.

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