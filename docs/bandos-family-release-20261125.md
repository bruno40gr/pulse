# BandOS and family profile release — November 25, 2026

## Included

- BandOS uses “Form a band” for entry and completion, and “No bands being formed”
  for the empty draft state. Saved profile drafts appear once in the main list;
  resumable creation drafts remain accessible without the redundant wrapper.
- Removed BandOS search and shortened band messaging instructions. Removed the
  individual-email informational notice without changing routing or consent.
- Current contact panels use a Family members card for both holders and students.
  Excludes self, deduplicates roles, places Account holder / Student labels below
  linked names, and omits repeated phone/email. No crown or parentheses.
- Student siblings are linked directly. Contacts and Communications retain an
  in-panel Back trail. Account-only holder summaries link to their saved account
  panels; identities come from explicit saved IDs, never name/email matching.
- Keeps Add student with the same permission checks and persistence path.
- Includes the reviewed Communications current-panel migration and SMS handoff
  preserving the mounted composer, thread, draft and focus.

## Verification

- 316 focused offline tests passed; TypeScript and targeted ESLint passed.
- Family members, BandOS and Communications browser acceptance passed at 1440px
  and 390px with synthetic APIs and no outgoing provider sends.
- Existing broad live-contact browser acceptance has stale expectations for the
  dependent count and a removed composer Back control. The focused family browser
  script covers the new presentation/navigation; the broad script is not claimed
  as passing.
- Retired ContactSlidePanel callers outside Communications remain for a separate
  migration. No database changes are required by this release.