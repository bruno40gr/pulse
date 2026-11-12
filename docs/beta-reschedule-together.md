# Beta: Reschedule together

In an account holder's Schedule & lessons list, eligible lesson cards have
checkboxes. Selecting one or more reveals the count, Reschedule together and Clear
selection. No bulk action is shown without a selection. The planner keeps each
selected lesson in a focusable card and shows compatible availability for the
focused lesson on the family calendar.

Selection is not a commitment to move. Each card shows Unchanged or an explicit
original-to-proposed summary, with Undo change. Confirmation counts only proposed
changes. Existing single-lesson actions and makeup booking remain available.
This release changes individual occurrences, not recurring subscription schedules.

Drafts are in-memory and nothing is saved while choosing times. A lesson without
a proposal keeps its original occupancy. Other proposed moves are projected into
availability; final validation checks every proposed move against the complete
arrangement before returning any updated sample state. If any move is invalid,
none are applied. Back to schedule asks before discarding pending proposals.

All implementation is confined to Beta sample components/data. No production
booking APIs, migrations or operational writes were added. Account navigation and
browser Back clear the planner. Existing Beta authorization remains unchanged.

Validation: TypeScript, targeted lint and 82 scoped tests pass. Synthetic tests
cover one/two moves, unchanged siblings, ownership, immutable failure and unchanged
subscriptions. Desktop/mobile browser checks cover hidden/visible action,
checkbox/clear selection, focus switching, tentative selections, Undo, and saving
only one of two selected lessons. Existing single-reschedule/makeup browser checks
are rerun. Browser tests use an isolated loopback host with synthetic identities.

Try BETA → Contacts → Sam Ibrahim → Schedule & lessons (List). Check Adam and
Sara, select Reschedule together, then use Choose time on either planning card.