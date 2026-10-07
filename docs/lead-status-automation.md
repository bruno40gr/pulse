# Conservative lead-status automation

## Initial scope

Only newly saved staff notes on lesson, tour and service inquiries are evaluated.
Website submission messages, historical notes, call attempts, conversation traffic,
job applications and winback records do not trigger automatic changes.

- Clear completed outreach (for example, `Left a voicemail`, `Called and left VM`,
  `Spoke with parent`) can advance **New → Contacted**.
- Explicit booking confirmation (for example, `Booked a lesson with Josh on Tuesday`,
  `Trial confirmed for Tuesday`) can advance **New/Contacted → Booked**.
- Notes do not create calendar bookings or automatically set Enrolling/Won.
- Negations, uncertain language, questions, quoted text and future intent suppress
  evaluation of the entire note. This intentionally favors missed matches over
  false positives: even `No answer; left a voicemail` is left for manual review.

## Human control

An explicit manual status selection pauses future automation, even when the same
status is selected. Editing unrelated lead fields does not pause automation.
The card offers **Pause automatic updates** and **Resume automatic updates**.
Resume only applies to future notes; it does not replay old notes.

Automatic changes show the detected reason and an **Undo** action. Undo restores
the preceding status and pauses automation. A change ID and current-status check
reject stale Undo requests. Won, Lost, Spam, Ghosted and later open stages cannot
be overwritten by the initial note rules.

## Persistence and reliability

Server-managed `payload.status_automation` stores pause state and the latest
automatic decision (ID, previous/next status, reason, evidence, source note ID,
and timestamp). Generic payload edits cannot forge this metadata. No schema
migration or external AI service is required.

Evaluation starts after the note insert succeeds. Automatic updates compare the
tenant, lead ID, status and `updated_at` snapshot before writing. A concurrent
human edit invalidates the snapshot. Records without an update timestamp are
skipped rather than updated unsafely.

Decision metadata is persisted with status in one write; `status_automated`
history is then appended. A history failure is logged, with evidence retained in
the lead payload. Automation failure does not reject the already saved note.
Manual edits also use a version check and return a conflict rather than replacing
newer data. Existing note-save/history writes are not a single database transaction.

## Tests

Run `node --test scripts/security/*.test.cjs` from the repository root. The suite
includes positive/negative phrase examples, manual overrides, pause/resume,
Undo, protected states, tenant isolation, repeated note IDs, concurrent edits,
and automation failure behavior. Tests use synthetic data, without provider or
production database calls.