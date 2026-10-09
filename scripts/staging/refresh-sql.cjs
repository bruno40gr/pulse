const { randomBytes } = require('node:crypto');
const { TABLES } = require('./sanitize-snapshot.cjs');
function addEdgeCases(s) {
  const template=s.crm_contacts[0]; const intake=s.lead_intakes[0];
  if(!template || !intake)throw Error('Lead templates required');
  const cases=[
    ['Edge case: very long surname', 'Alexandria', 'Van der Extremely-Long-Surname-'.repeat(8)],
    ['Edge case: Unicode', 'Zoë 李', 'O’Connor–山田 🧪'],
    ['Edge case: missing contact details', 'Test', 'Missing'],
  ];
  cases.forEach(([label,first,last],i)=>{
    const id=`eeeeeeee-0000-4000-a000-00000000000${i+1}`;
    const lead=`eeeeeeee-0000-4000-b000-00000000000${i+1}`;
    s.crm_contacts.push({...template,id,first_name:first,last_name:last,full_name:`${first} ${last}`,tenant_id:s.tenants[0].id,email:i===2?null:`edge${i}@example.invalid`,phone:null,notes:label});
    s.lead_intakes.push({...intake,id:lead,tenant_id:s.tenants[0].id,contact_id:id,source_system:'staging-synthetic',source_form:'edge-case',intake_type:'lesson_inquiry',payload:{message:`${label}\n${'Synthetic multiline note.\n'.repeat(100)}`,potential_value_base:0.01,potential_value_total:99999.99,sibling_count:0}});
  });
}
function importSql(s) {
  const tag=`$staging_${randomBytes(12).toString('hex')}$`;
  const insert=(t)=>`INSERT INTO public.${t} SELECT r.* FROM staging_refresh_snapshot s, jsonb_populate_recordset(NULL::public.${t},s.body->'${t}') r;`;
  return `BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE staging_refresh_snapshot(body jsonb) ON COMMIT DROP;
INSERT INTO staging_refresh_snapshot VALUES(${tag}${JSON.stringify(s)}${tag}::jsonb);
LOCK TABLE ${TABLES.map(t=>`public.${t}`).join(',')} IN ACCESS EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.roles WHERE key='staging_tester')
 OR EXISTS(SELECT 1 FROM public.tenants WHERE name NOT ILIKE 'staging%')
 OR EXISTS(SELECT 1 FROM public.twilio_config)
 OR EXISTS(SELECT 1 FROM auth.users)
 THEN RAISE EXCEPTION 'Not an isolated synthetic staging database'; END IF;
END $guard$;
-- Do not CASCADE. Unexpected dependents must cause rollback.
DELETE FROM public.note_replies;
DELETE FROM public.note_participants;
DELETE FROM public.notes;
DELETE FROM public.messages;
DELETE FROM public.lead_events;
DELETE FROM public.lead_intakes;
DELETE FROM public.crm_contacts;
DELETE FROM public.contacts;
DELETE FROM public.students;
DELETE FROM public.accounts;
DELETE FROM public.people p WHERE NOT EXISTS(SELECT 1 FROM public.instructors i WHERE i.person_id=p.id)
 AND NOT EXISTS(SELECT 1 FROM public.tenant_memberships m WHERE m.person_id=p.id);
INSERT INTO public.tenants SELECT r.* FROM staging_refresh_snapshot s,jsonb_populate_recordset(NULL::public.tenants,s.body->'tenants') r ON CONFLICT(id) DO NOTHING;
${['accounts','people','students','contacts','crm_contacts'].map(insert).join('\n')}
-- Preserve historical classifications/timestamps and imported history. Disable
-- only user triggers on this table, transactionally; FK triggers remain active.
ALTER TABLE public.lead_intakes DISABLE TRIGGER USER;
${insert('lead_intakes')}
ALTER TABLE public.lead_intakes ENABLE TRIGGER USER;
${['lead_events','messages','notes','note_replies'].map(insert).join('\n')}
DO $verify$ DECLARE target text; missing boolean; BEGIN
 FOREACH target IN ARRAY ARRAY[${TABLES.map(t=>`'${t}'`).join(',')}] LOOP
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM staging_refresh_snapshot s, jsonb_array_elements(s.body->%L) expected LEFT JOIN public.%I actual ON actual.id=(expected->>''id'')::uuid WHERE to_jsonb(actual) IS DISTINCT FROM expected)',target,target) INTO missing;
  IF missing THEN RAISE EXCEPTION 'Full record comparison failed: %',target; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.twilio_config) THEN RAISE EXCEPTION 'Unexpected integration'; END IF;
END $verify$;
COMMIT;
SELECT 'SANITIZED STAGING REFRESH COMMITTED; NO PRODUCTION WRITES' AS result;
`;
}
module.exports={importSql,addEdgeCases};