const test = require('node:test');
const assert = require('node:assert/strict');
const { TABLES, sanitizeSnapshot: transform, mask } = require('./sanitize-snapshot.cjs');
const sanitizeSnapshot = input => transform(input, 'synthetic-unit-test-salt-not-a-secret');
function snapshot() {
  const s = Object.fromEntries(TABLES.map(t => [t, []]));
  s.tenants = [{ id: '00000000-0000-0000-0000-000000000001', name: 'Real school', is_demo: false }];
  return s;
}
test('preserves relationships but remaps identities and removes free text', () => {
  const s = snapshot(); const id = '12345678-1234-4234-8234-123456789012';
  s.people = [{id, tenant_id:s.tenants[0].id, first_name:'Rose', last_name:'Very-Long Lastname', email:'rose@private.com', phone:'(415) 555-1234', custom_fields:{secret:'private token',student_name:'Isela',age:12}, notes_history:[{text:'Private message',timestamp:'2026-10-05T00:00:00Z'}]}];
  s.students = [{id:'12345678-1234-4234-8234-123456789013',person_id:id}];
  const out = sanitizeSnapshot(s);
  assert.equal(out.students[0].person_id,out.people[0].id);
  assert.notEqual(out.people[0].id,id);
  assert.equal(out.people[0].last_name.length,s.people[0].last_name.length);
  assert.match(out.people[0].email,/@example\.invalid$/);
  assert.equal(out.people[0].notes_history[0].timestamp,'2026-10-05T00:00:00Z');
  assert.equal(out.people[0].custom_fields.age,12);
  for (const text of ['Rose','Lastname','rose@private.com','415','Isela','Private message','private token','secret']) assert.ok(!JSON.stringify(out).includes(text));
  assert.deepEqual(sanitizeSnapshot(s),out);
});
test('preserves missing values, dates, numbers, status and multiline shape', () => {
  const s = snapshot(); s.lead_intakes=[{status:'new',created_at:'2026-10-05T00:00:00Z',payload:{potential_value_total:123.45,message:'Hello\n世界!',phone:null},email:'',phone:null}];
  const out = sanitizeSnapshot(s).lead_intakes[0];
  assert.equal(out.status,'new'); assert.equal(out.payload.potential_value_total,123.45);
  assert.equal(out.payload.message,'Xxxxx\n文文!'); assert.equal(out.email,'');assert.equal(out.phone,null);
});
test('excludes provider links, membership references and actual card flags', () => {
  const s=snapshot();s.messages=[{campaign_id:'12345678-1234-4234-8234-123456789012',media_url:'https://private.com',twilio_sid:'SMprivate'}];s.notes=[{created_by_membership_id:'12345678-1234-4234-8234-123456789012'}];s.accounts=[{card_on_file:true}];
  const out=sanitizeSnapshot(s);assert.equal(out.messages[0].media_url,null);assert.equal(out.messages[0].campaign_id,null);assert.equal(out.notes[0].created_by_membership_id,null);assert.equal(out.accounts[0].card_on_file,false);
});
test('refuses unreviewed tables and tenants', () => {
  assert.throws(()=>sanitizeSnapshot({...snapshot(),twilio_config:[]}));
  const s=snapshot();s.tenants[0].id='12345678-1234-4234-8234-123456789012';assert.throws(()=>sanitizeSnapshot(s));
});
test('mask removes Unicode identities while preserving codepoint lengths',()=>{
  const value='Zoë 李 🐈\n123';assert.equal([...mask(value)].length,[...value].length);assert.ok(!mask(value).includes('Zoë'));assert.equal(mask(value).split('\n').length,2);
});