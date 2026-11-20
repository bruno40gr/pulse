-- A band's teacher is an assignment on the band, not a member row.
-- Enrolment instructors still win once lessons exist; this covers a band that
-- has no enrolments yet, including one created from the band wizard.

alter table if exists public.band_profiles
  add column if not exists coach_person_id uuid references public.people(id) on delete set null;

comment on column public.band_profiles.coach_person_id is
  'Staff assigned to lead the band when no enrolment instructor is recorded.';
