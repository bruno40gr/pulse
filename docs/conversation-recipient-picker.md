# Communications text recipients

The new-text and edit-recipient dialogs share the same Family/Student picker.

- Family view is the default: one row per normalized SMS destination, with linked
  students nested below and only the recipient row selectable.
- Searching a parent or student keeps the family structure visible. Selecting a
  student match retains that student's contact reference for conversation context.
- Student view exposes individual student names; selection chips and the opened
  conversation identify the actual routed recipient.
- Switching views preserves selection. Siblings sharing a phone count as one
  recipient; identical names with different phones remain distinct.
- No contacts are merged or deleted. Server authorization, opt-outs and recipient
  resolution remain authoritative. Missing/invalid destinations are not selectable.
- The shared wide modal provides space for family rows and remains viewport-bound.

The fictional example at `/dashboard/design/contacts-table` reuses the production
picker without sending. Browser regression coverage exercises both views, search,
selection, view changes and editing at desktop/tablet/mobile widths.