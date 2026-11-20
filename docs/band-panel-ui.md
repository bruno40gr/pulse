# Band profile panel

BandOS follows the contact profile hierarchy: avatar/title header, separate
communication/edit action bar, horizontally scrollable tabs, muted content canvas,
and flat white section cards with top-right header actions.

Use `SlidePanelContent` for the canvas, not page-specific padding/backgrounds.
Its presentation traits are `tone` (`muted` / `default`), `density`
(`comfortable` / `compact`), and `layout` (`stack` / responsive `columns`).
Use existing `DenseSectionPanel` traits for the section title, actions, tone,
appearance and content spacing, and `FieldGrid` for at most two fields per row.
Details, Members, Notes, Scheduling, Curriculum and Communications share this
structure; unavailable features say so rather than showing fake data.

## Communications

- Select members or use Message on one row. Account-holder routing is resolved
  by the existing Contacts recipient service, not by client-supplied addresses.
  Minors never fall back to their own destinations; adult self-routing follows
  their saved Contacts preference. Multiple linked holders can receive messages.
- The existing SMS composer sends separate messages, not a group conversation.
  Shared family destinations are deduplicated and opt-outs remain enforced.
- Default email delivery reuses the existing durable individual-email composer.
- Explicit CC/BCC email uses the same rich editor and recipient picker. It starts
  all selected eligible destinations in BCC. Use Manage recipients to remove a
  destination from BCC and select it in CC or To. CC/To expose addresses; BCC does
  not. An all-BCC message uses the organisation sender as its visible To address.
- Shared emails have a 50-recipient cap and are checked server-side against a
  fresh tenant-scoped routed audience/version and authorised organisation sender.
  Staff need communications send and contact read access; portal roles are denied.
- Shared email sends are not automatically retried. The composer locks after a
  send attempt to prevent double-click/retry duplicates and warns on ambiguity.
  Unlike individual-email batches, shared sends do not yet have a durable
  cross-session idempotency ledger. Check Sent before starting a new send after
  a timeout; closing/reopening is not a safe retry mechanism.

No new schema migration is needed for Communications. Existing Contacts account
routing, SMS configuration and organisation-mailbox setup must already be active.
The separate band-notes migration is still required for Notes.