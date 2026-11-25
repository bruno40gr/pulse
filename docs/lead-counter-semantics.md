# Lead totals and notification badges

- Lesson requests and Service inquiries show only their red notification badge,
  not a second neutral list total. List totals remain available in the API and
  table summary; existing-student opportunities remain in the lists.
- Red bubbles on those two tabs show inquiries still tagged `new` and created
  less than 24 hours ago: the badge expires at 24 hours or on leaving New,
  whichever comes first. Future-dated and missing-date records do not count.
  These must have no canonical
  `person_id`, excluding win-back imports and legacy `contact-band-opportunity`
  records. Tour requests belong to Lesson requests. Other tabs have no new-lead
  bubble. Zero notification counts are hidden.
- The left-navigation Leads bubble is the sum of the two red tab bubbles. It is
  not the sum of the open pipeline totals and does not include existing students
  seeking another service, applications, enrolled/lost records, or win-back leads.
- `count_only=1` returns `{ count, newCounts }`; `summary_only=1` returns both
  `counts` (list totals) and `newCounts` (notifications). Notification counts do
  not change when the list's status filter changes.
- Identity uses canonical links and the known legacy band source, not name/email
  matching. “Net-new” requires an unlinked identity as well as the status and age rules. An unlinked duplicate is not automatically inferred to be an existing
  person; fix its identity link rather than guessing from a shared family address.
- Creation/mutation events refresh counts. The panel also refreshes its summary
  on window focus; navigation retains its existing visible polling.