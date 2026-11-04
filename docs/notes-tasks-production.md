# Dashboard Notes and tasks

Production entry point: `/dashboard/notes`, rendered by `components/notes/DashboardNotes.tsx`.
The design prototype and its fictional localStorage model have been removed.
Existing prototype browser data is not imported into real accounts.

## Deployment order

1. Apply `supabase/migrations/202611040001_note_tasks.sql` to the primary Notes
   database before deploying this application version. It adds nullable
   `notes.follow_up`, a shape constraint, an owner index and the service-role-only
   `save_note_task` function. Existing notes and completion history are unchanged.
2. Deploy the application. Old application versions tolerate the additive column.
3. Verify Notes and task controls using the synthetic browser script. Do not
   create production notes or send mention notifications just to test deployment.

Application rollback is non-destructive: redeploy the preceding application and
leave the nullable column/function intact. Do not drop task data to roll back UI.

## Behavior and access

- Notes use real `/api/notes` persistence, optional title generation, real
  `NoteConversationPanel` replies and existing mention notifications.
- Selecting an eligible staff mention, or typing its complete directory name,
  reveals Create a task / Convert to task. Bare @, unknown names and client-only
  mentions do not. Selecting a client mention can preselect Related to separately
  from the staff owner; client mentions never send staff mention notifications.
- Task description starts from the note body. Due date uses local calendar days;
  Related to searches permitted contacts and CRM leads; Owner is a current,
  non-suspended tenant membership. No fictional identities or avatar URLs.
- Conversion updates the same ID and does not replace body, color, pin, privacy,
  author, creation date or replies. Editing task description does not overwrite
  the original note body. Existing saved task fields win over mention defaults.
- Reassigning a private task adds its owner to the entire private conversation,
  including past replies. The form explains this. Existing participants remain.
  Assignment and the new participant save together in a database transaction.
- Notes read/manage permissions and private-note access are checked server-side.
  Owners and new related links are tenant-validated; related searches also check
  contacts/leads read permissions. Existing unavailable links remain preserved
  unless explicitly cleared or changed.
- All notes includes notes and tasks; Open tasks excludes completed tasks; My
  tasks uses the authenticated membership, not a display name. Hide done applies
  to All notes and My tasks. Date filters use the existing `note_date` field.
- Plain notes and tasks both retain the header Mark done / Done control. Plain
  note completion does not create a task; it uses the same notes.manage permission
  and private-note access check, persists across reloads, and respects Hide done.
- Inline edits save on blur/click-out. Failed saves keep the draft visible with
  a retry message. Creation and task failures retain the form; cancelling new
  task creation does not save an orphan note.
- Delete requires confirmation. Notification deep links continue opening the
  real conversation, including completed notes, subject to authorization.
- No automatic reminders, external messages, new assignment notifications or
  scheduled jobs are added; existing mention notification behavior is retained.

The approved amber palette and control states are scoped to Dashboard Notes;
shared NotesSection, contact panels and Odeon are unchanged. MentionTextarea's
related-person search and highlighting are opt-in for Dashboard Notes only.

## Validation

```
node --test scripts/security/*.test.cjs
./node_modules/.bin/tsc --noEmit
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/security/notes-production-browser.cjs
```

Browser tests intercept all API traffic and cover 1440/900/390px, conversion,
original metadata/replies, task filters, completion/reopen, reload persistence
contracts, failed-save retention and cancelled/new task creation. API tests cover
tenant isolation, owner/related-record validation, read/manage permissions,
private-note access, atomic assignment errors and participant insertion. Contrast
tests retain the eight-color normal/focused/completed checks.