# Beta: Reschedule together

In an account holder's Schedule & lessons list, eligible lesson cards have
checkboxes. Selecting one or more reveals the count, Reschedule together and Clear
selection. No bulk action is shown without a selection. The planner keeps each
selected lesson in a focusable card and shows compatible availability for the
focused lesson on the family calendar.

Selection is not a commitment to move.
Discovery controls use a compact, content-sized filter row. Date range displays
both native date inputs side by side without stacked visual labels (accessible
From date / Through date labels remain). Inactive modes are unmounted and cannot
reserve the former tall FieldGrid height. Desktop mode changes keep the row at
shared control height; narrow containers wrap the date group while keeping its
two inputs together. No per-mode offsets or forced row heights are used.

Selection actions reuse the existing TableContextActionBar and TableResultsSlot
from the maintained UI library, not a parallel blue-bar implementation. The bar
replaces the normal lesson count in the reserved results row below discovery
controls, with Cancel/Reschedule actions and an accessible X to clear. Selecting
or clearing lessons does not shift the first lesson. Calendar view stays weekly.

One selection exposes Reschedule and Cancel; multiple selections expose
Reschedule together and Cancel together. Cancellation opens a shared Modal review
listing each selected occurrence and its normal makeup-credit outcome. The final
Cancel uses the existing hold-to-confirm control. It preserves the 24-hour rule,
returns eligible booked makeup credits, forfeits late booked makeup credits, and
does not alter recurring subscriptions. Cancellation stages all operations
immutably; invalid/unauthorized/already-started lessons reject the entire batch.
Staff makeup-credit exceptions remain in the existing individual lesson flow.

List view supports This week, All weeks (upcoming through the available Beta
schedule horizon, April 1, 2027), and an inclusive From/Through date range.
Calendar view remains weekly; returning to List retains its date filter and
selection. Selections can span weeks. List cards show the student name even in
student-scoped views, with a clear checkbox gutter and aligned staff row.

Each planner card separates Original and New time, with bold dates/times and
secondary teacher text. The whole card is a keyboard-accessible focus control;
focusing it jumps to its proposed week, or original week if unchanged. Clear in
the header removes only that proposal, without changing the focused lesson.
Confirmation counts only proposed
changes. Existing single-lesson actions and makeup booking remain available.
This release changes individual occurrences, not recurring subscription schedules.

Drafts are in-memory and nothing is saved while choosing times. A lesson without
a proposal keeps its original occupancy. Other proposed moves are projected into
availability; final validation checks every proposed move against the complete
arrangement before returning any updated sample state. If any move is invalid,
none are applied. The existing back arrow asks before discarding pending proposals;
there is no separate Back to schedule / selected-count header.

Original bookings remain visible at their original times while exploring drafts.
They use neutral styling; proposed moves use the selected-replacement blue, including
other children's proposals when focus switches. Compact blocks show first name,
program and time on clipped single lines, with full details in the accessible label
and hover title. A long name or program cannot spill into an adjacent time block.

All implementation is confined to Beta sample components/data. No production
booking APIs, migrations or operational writes were added. Account navigation and
browser Back clear the planner. Existing Beta authorization remains unchanged.

Validation: TypeScript, targeted lint and 82 scoped tests pass. Synthetic tests
cover one/two moves, unchanged siblings, ownership, immutable failure and unchanged
subscriptions. Desktop/mobile browser checks cover hidden/visible action,
checkbox/clear selection, focus switching, tentative selections, Clear, and saving
only one of two selected lessons. Existing single-reschedule/makeup browser checks
are rerun. Browser tests use an isolated loopback host with synthetic identities.
The multiweek browser regression additionally verifies all-weeks/date filtering,
list alignment, three occurrences across three weeks, whole-card/keyboard focus,
automatic week jumps, independent Clear, and a confirmed three-change batch at
1440px and 390px. A synthetic test covers atomic three-week validation/failure.
The selection browser regression checks compact desktop toolbar geometry across all three
date modes, side-by-side date inputs on desktop/mobile, shared blue action bar at 1440/900/390px, matching control heights, single/plural labels,
cancellation review/dismiss/early release/commit and credit outcomes. Synthetic
tests cover atomic cancellation failure, ownership, duplicates, past lessons,
repeat cancellation, and booked makeup return/forfeit behavior.

Try BETA → Contacts → Sam Ibrahim → Schedule & lessons (List). Check Adam and
Sara, select Reschedule together, then select either planning card.