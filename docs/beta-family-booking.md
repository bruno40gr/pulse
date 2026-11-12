# Beta family booking calendar

Beta's account-holder panel now keeps the household's regular lessons and booked
makeups visible while rescheduling or booking a makeup. Reference blocks identify
the student, program and teacher; the moving occurrence is marked Original lesson.
Unused credits and other households are excluded. References are display-only:
the existing makeup availability engine validates the student, teacher and
applicable room, while sibling overlaps may remain valid.

Booking summaries identify the student and original lesson/credit. Week navigation
expands the sample schedule and retains the selected week when returning. A newly
booked makeup returns to the calendar for its booking week. Selecting a candidate
does not mutate bookings; the existing hold-to-confirm interaction applies it.

All changes are confined to beta-source and local sample state. No operational
booking API, authorization, enrollment or production database behavior changes.

Validation: TypeScript and targeted lint pass; 78 scoped tests pass, including
household isolation, booked makeup references, sibling overlap and child conflict.
The isolated browser test `scripts/security/beta-family-booking-browser.cjs` passes
at 1440px and 390px for account-holder reschedule and makeup selection/confirmation,
family visibility, week retention, persisted sample state, no document overflow,
no runtime errors and no operational writes. Review artifacts are
`/tmp/beta-family-{reschedule,makeup}-{1440,390}.png`.

To try: BETA / Academy preview → Contacts → Sam Ibrahim → Schedule & lessons →
Calendar → Sara's lesson actions → Reschedule lesson. The Makeups tab also has
Sara's unused makeup credit. Adam's lessons remain visible during either task.
Changes are tab-local sample state, not shared with other testers.