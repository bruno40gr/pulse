# Adding a person to something

Use this convention for event participants, band members and future person-to-entity flows. The reference is enrollment's “Add a contact” form.

- Start with the shared `RadioOptionGroup`, stacked full-width: **Existing contact**, then **New contact**. Use the shared selected surface, border and focus styles.
- Existing contact reveals search and bounded results. Preserve single selection for one participant and multi-selection where the destination accepts multiple people. Already-associated contacts remain disabled. Loading, errors and empty results are distinct states.
- New contact reveals **Contact details** and `ContactDetailsFields`: First name / Last name, Email / Phone, Birthday. Use the shared responsive two-column `FieldGrid`; collapse on narrow containers. Do not replace these with a combined name field or a second modal.
- Keep drafts and selections while changing mode. Destination-specific validation remains in the adapter/workflow; do not silently drop phone or birthday. Persist canonical identity before associating a new operational contact.
- Use `ParticipantPicker` for event/band selection, `BandStudentPicker` for the operational contact API adapter, and `ContactDetailsFields` for enrollment's existing person editor. The surrounding workflow owns its Continue/Add action and any required consent or relationship fields. New contact creation must not bypass destination-specific review.
- These are shared fields/compositions, not a claim that all enrollment lookup and participant-table behaviors are identical.

## Menus within tables

Do not remove borders or table scrolling to make menus fit. Shared row action menus and multi-selects render in a viewport-bounded portal, inside the nearest dialog when present, and reposition on scroll/resize. Verify the bottom row, narrow viewport, outside click, keyboard navigation, Tab and Escape without dismissing the parent dialog.