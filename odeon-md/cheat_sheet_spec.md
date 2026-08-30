# Cheat Sheet — Venue-Mandated Task Assist (spec)

*Companion to CharterFlow_BRD.md §6.6 (venue-mandated vs. artifact-mandated) and Appendix G (browser extension, the later-phase successor to this feature). This describes the v1, no-extension version.*

## What it is

A compact reference panel attached to a venue-mandated document task, opened side-by-side with the funder's own form (their DocuSign, their portal). It does not automate anything: it removes the hunting, the transcription errors, and the amnesia. The typing into the funder's venue remains manual until the Appendix G extension exists.

## Where it lives

On the document task itself, on the case. Venue-mandated tasks show an "Open cheat sheet" action in place of the upload/fill surface that artifact-mandated tasks get.

## When it triggers

When the venue-mandated task is created, by either path:
- Manually: vendor logs the inbound request ("ACE FMS sent a DocuSign for the vendor agreement," link attached).
- Automatically (once Appendix C email-forward ingest exists): the forwarded DocuSign/portal notification creates the task with the link attached.

The cheat sheet exists the moment the task does.

## Window behavior

- "Open cheat sheet" pops a compact, narrow window (sized for a side strip, not a full tab), placed by the user beside the funder's tab.
- Interaction rhythm: copy in panel → paste in their form, field by field.
- Mobile degrades to app-switching with per-field copy. Workable, not lovely.
- A web app cannot overlay or auto-populate the funder's tab; that is exactly and only what the Appendix G extension adds later.

## Panel contents

Two sections:

1. **"This form asks for"** — shown when the profile has field knowledge for this specific form, listing exactly the fields it requests, in the order they appear. Field knowledge is learned from the first completion (same pattern as click-to-place template promotion: observed once, confirmed by a human, reused after).
2. **"Also in your vault"** — the fallback, always present: legal entity name, DBA, EIN, business address, phone, license number, CDTFA permit, eligible service codes, ACH details.

Every value is one-click copy. No text selection, no retyping identifiers.

## Security treatment (per BRD §7)

- Banking fields (routing, account number) render **masked** by default.
- An explicit **Reveal** click is required before copy is available.
- Every reveal of a banking field is **access-logged** (who, when, which task).
- The panel inherits vault permissions; it is a view onto the vault, not a copy of it.

## Task lifecycle integration

- The task carries the standard states and is subject to **Overdue** like any other document task — an inbound DocuSign can no longer die silently in an inbox.
- **Mark completed** closes the task on the case.
- The completed copy the venue emails back is filed into the case's document hub.
- Two things become profile knowledge on completion: that this funder venue-mandates this step, and (after human confirmation) the form's field list for the next occurrence.

## Explicit limits (v1)

- Does not fill the funder's form. Copy/paste only.
- Does not substitute CharterFlow's own version for the funder's venue — never offered, per §6.6.
- Field-order knowledge exists only after a first completion; unknown forms get the full-vault fallback view.
