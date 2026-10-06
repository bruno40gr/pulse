// Local only: creates its own disposable Docker database; never loads .env.
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');

const docker = existsSync('/Applications/Docker.app/Contents/Resources/bin/docker')
  ? '/Applications/Docker.app/Contents/Resources/bin/docker' : 'docker';
const name = `odeon-crm-rehearsal-${process.pid}-${Date.now()}`;
const localPassword = randomBytes(32).toString('hex');
const run = (args, input) => execFileSync(docker, args, {
  input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 180000,
  env: { ...process.env, POSTGRES_PASSWORD: localPassword,
    PATH: `/Applications/Docker.app/Contents/Resources/bin:${process.env.PATH || ''}` },
});
const sql = (text) => run(['exec', '-i', name, 'psql', '-X', '-U', 'postgres',
  '-d', 'rehearsal', '-v', 'ON_ERROR_STOP=1'], text);
let started = false;
try {
  // Image download is the only required external operation. No published ports.
  run(['pull', 'postgres:17']);
  run(['run', '-d', '--name', name, '--network', 'none',
    '-e', 'POSTGRES_DB=rehearsal', '-e', 'POSTGRES_PASSWORD', 'postgres:17'], undefined);
  started = true;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { run(['exec', name, 'pg_isready', '-U', 'postgres']); ready = true; break; }
    catch { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
  }
  if (!ready) throw new Error('Local database did not become ready');
  sql(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    CREATE TABLE public.tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(), last_synced_at TIMESTAMPTZ,
      is_demo BOOLEAN DEFAULT false
    );
    INSERT INTO public.tenants (id,name) VALUES
      ('00000000-0000-0000-0000-000000000001','Synthetic school');
  `);
  sql(readFileSync(join(__dirname, '01-schema.sql'), 'utf8'));
  sql(`
    SET ROLE service_role;
    INSERT INTO public.crm_contacts (id,tenant_id,full_name,created_at,updated_at)
    VALUES ('10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001','Synthetic contact',
      '2020-01-01T00:00:00Z','2020-01-02T00:00:00Z');
    INSERT INTO public.lead_intakes
      (id,tenant_id,contact_id,intake_type,source_form,category,status,created_at,updated_at)
    VALUES ('20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
      'tour_request','synthetic','historical_manual_category','won',
      '2020-01-01T00:00:00Z','2020-01-02T00:00:00Z');
    INSERT INTO public.lead_events (tenant_id,lead_intake_id,event_type,created_at)
    VALUES ('00000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001','historical','2020-01-01T00:00:00Z');
    RESET ROLE;
    DO $$ BEGIN
      IF (SELECT count(*) FROM public.lead_events) <> 1 THEN
        RAISE EXCEPTION 'Historical import generated extra events'; END IF;
    END $$;
  `);
  sql(readFileSync(join(__dirname, '02-triggers.sql'), 'utf8'));
  sql(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.lead_intakes WHERE
        id='20000000-0000-0000-0000-000000000001'
        AND category='historical_manual_category' AND status='won'
        AND created_at='2020-01-01T00:00:00Z' AND updated_at='2020-01-02T00:00:00Z')
      THEN RAISE EXCEPTION 'Historical content changed'; END IF;
      IF (SELECT count(*) FROM public.lead_events) <> 1 THEN
        RAISE EXCEPTION 'Trigger installation duplicated history'; END IF;
    END $$;
    SET ROLE service_role;
    INSERT INTO public.lead_intakes (tenant_id,contact_id,intake_type,source_form,program_label)
    SELECT '00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',kind,'synthetic',program
    FROM (VALUES ('tour_request',NULL),('service_inquiry',NULL),
      ('lesson_inquiry','Tiny Keys'),('lesson_inquiry','Wonder Notes'),
      ('lesson_inquiry','Private Lessons'),('lesson_inquiry','Voice'),
      ('unknown',NULL)) AS examples(kind,program);
    INSERT INTO public.job_applications (tenant_id,contact_id,full_name,email,message)
    VALUES ('00000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001','Synthetic applicant',
      'fake@example.invalid','Synthetic message');
    UPDATE public.crm_contacts SET notes='updated' WHERE
      id='10000000-0000-0000-0000-000000000001';
    UPDATE public.lead_intakes SET status='contacted' WHERE category='lessons';
    UPDATE public.job_applications SET status='reviewing';
    RESET ROLE;
    DO $$ DECLARE target text; BEGIN
      IF (SELECT count(*) FROM public.lead_events WHERE event_type='created') <> 7 THEN
        RAISE EXCEPTION 'New inquiry event count incorrect'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.lead_intakes WHERE category='tour'
        AND priority='high' AND temperature='hot') THEN RAISE EXCEPTION 'Tour classification failed'; END IF;
      IF (SELECT count(*) FROM public.lead_intakes WHERE category='early_childhood') <> 2
        OR (SELECT count(*) FROM public.lead_intakes WHERE category IN
          ('services','private_lessons','lessons','other')) <> 4 THEN
        RAISE EXCEPTION 'Classification branches failed'; END IF;
      IF EXISTS (SELECT 1 FROM public.lead_events e JOIN public.lead_intakes l
        ON l.id=e.lead_intake_id WHERE e.event_type='created'
        AND (e.contact_id IS DISTINCT FROM l.contact_id OR e.tenant_id <> l.tenant_id
          OR e.payload->>'category' <> l.category)) THEN
        RAISE EXCEPTION 'Created event payload/link mismatch'; END IF;
      IF EXISTS (SELECT 1 FROM public.crm_contacts WHERE notes='updated'
        AND updated_at='2020-01-02T00:00:00Z') THEN RAISE EXCEPTION 'Update trigger failed'; END IF;
      FOREACH target IN ARRAY ARRAY['crm_contacts','lead_intakes','lead_events','job_applications'] LOOP
        IF has_table_privilege('anon','public.'||target,'SELECT')
          OR has_table_privilege('authenticated','public.'||target,'INSERT') THEN
          RAISE EXCEPTION 'Browser-role grants remain on %',target; END IF;
        IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||target)::regclass)
          THEN RAISE EXCEPTION 'RLS missing on %',target; END IF;
      END LOOP;
      BEGIN
        INSERT INTO public.lead_intakes (tenant_id,contact_id,intake_type,source_form)
        VALUES ('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'lesson_inquiry','synthetic');
        RAISE EXCEPTION 'Missing contact accepted';
      EXCEPTION WHEN foreign_key_violation THEN NULL; END;
    END $$;
    SELECT 'PASS: historical preservation, classification, event creation, updates, application insert, grants, RLS, foreign keys' AS result;
  `);
  console.log('PASS: CRM schema and trigger rehearsal on isolated PostgreSQL 17.');
} finally {
  if (started) run(['rm', '-f', '-v', name]);
}