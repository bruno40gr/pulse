# Lead totals and notification badges

- Lesson requests and Service inquiries retain neutral totals for all records in
  their open lists, including opportunities about existing students. These totals
  follow the status filter and exclude the closed/win-back lifecycle partitions.
- Red bubbles on those two tabs show only `new` inquiries with no canonical
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
  matching. An unlinked duplicate is not automatically inferred to be an existing
  person; fix its identity link rather than guessing from a shared family address.
- Creation/mutation events refresh counts. The panel also refreshes its summary
  on window focus; navigation retains its existing visible polling.