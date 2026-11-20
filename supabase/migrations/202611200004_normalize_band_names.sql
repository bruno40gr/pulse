-- Imported band rows put the instrument track ("Drums 101") in band_name and the
-- ensemble in session_name. Normalize band_name to the ensemble; the played
-- instrument stays in `instrument`. Rows whose session is a lesson are left alone
-- because their band assignment is genuinely unknown.
BEGIN;

UPDATE public.enrollments e
   SET custom_fields = jsonb_set(coalesce(e.custom_fields, '{}'::jsonb), '{band_name}', to_jsonb(e.session_name))
 WHERE e.service_type = 'band'
   AND e.session_name IS NOT NULL
   AND coalesce(e.custom_fields->>'band_name', '') ~* '^(bass|drums?|guitar|voice|vocals?|piano|keys|keyboard|percussion)\s*\d'
   AND e.session_name !~* '(level|lesson|private|semi-private|group|class)';

COMMIT;
