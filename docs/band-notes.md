# Internal band notes

BandOS's band detail panel reuses `DashboardNotes` in the Notes tab. It is the
same composition as the general Notes workspace, scoped by tenant and band:
notes, editing, completion, colors, pinning, private participants, replies,
mentions and follow-up tasks remain in the existing notes system.

## Access

- Operational staff membership is required; demo/family/student/parent/guardian/
  customer access is not sufficient.
- Owners may access; other staff need `contacts.read` plus `notes.read` to read,
  and `contacts.read` plus `notes.manage` to write. This is not coach-only access.
- Private participant restrictions still apply, even for owners.
- List, direct mutation, reply and general notes URLs all enforce band access.
- Mention recipients and task owners must also be eligible to read band notes,
  so internal notification previews are not sent to family-only memberships.
- Band membership does not grant note access. No family/student portal surface
  or notification opt-in is introduced.

## Deployment and identity

Apply `supabase/migrations/202611210002_band_notes.sql` before enabling the UI.
This additive migration adds nullable `notes.band_name`, an index and a
tenant/band composite FK to `band_profiles`, with update cascade and restricted
physical deletion. Existing general notes retain null context; notes are never
copied into contact histories. The migration also restricts direct client access
to notes/replies; the authorized service-role APIs remain the entry points.

The authoritative roster validates requested band names, including imported bands
without a profile. On first note creation, a missing profile is inserted with
duplicate-ignore semantics: existing status, coach and scheduling details are
not overwritten. Renaming a profile cascades note context in the database;
archiving retains notes/history. A rename implementation that physically deletes
a referenced profile will fail rather than orphan notes and must be reconciled
before deployment. Verify the deployed `rename_band` function against the FK.

This change does not migrate bands to a new UUID identity model. It does not
apply the migration to a live database automatically.