# Communications contact profile migration — November 25, 2026

## Cause and repair

Communications explicitly imported `ContactSlidePanel` in
`ConversationProfilePanel`, bypassing the operational Contacts migration to
`LiveContactPanel`. This was an obsolete caller, not a need for a new profile UI.

- Changed the entry label and accessible name from View lead to View contact.
- Replaced the obsolete contact-panel renderer with the existing LiveContactPanel.
- Reused tenant-scoped contact roster capabilities and family identity helpers;
  no permission is inferred from having a conversation or a phone number.
- Kept student/holder navigation, notes updates, family refresh and edit transport.
- Added an optional contextual compose callback to LiveContactPanel. In this
  context, SMS closes the profile via the mobile-history-aware dismiss function,
  then focuses the existing conversation textarea without remounting it or
  resetting its thread/draft. Email returns to the existing email flow.
- The callback applies only to the original profile recipient. After navigating
  to another family person, their normal profile composer remains responsible
  for their recipient; it cannot silently send through the original thread.
- Standalone Contacts behavior is unchanged.

## Remaining legacy callers (not deleted blindly)

ContactSlidePanel remains imported by Overview, Staff, Funding, and the Contacts
fallback/prototype path. They need separate caller migrations before the file can
be deleted safely. Communications no longer imports it. Opportunity-only records
continue using LeadDetailPanel, the existing Leads workspace implementation;
this change does not invent a person ID for a lead or relabel lead data as a
student profile.

## Verification

- 136 focused conversation, profile, identity, and SMS-history tests passed.
- TypeScript, targeted ESLint, and git diff checks passed.
- New browser acceptance passed at 1440px and 390px: current half-width/fullscreen
  profile, loading skeleton, unchanged mounted SMS textarea and draft, focus
  restoration, Escape, profile-error recovery, and zero provider sends.
- Browser APIs are synthetic. Local uncommitted changes; production deployment
  has not been performed for this migration.
- Existing conversation browser acceptance expectations were updated for the
  current contact label/panel width; that broader browser script was not rerun.