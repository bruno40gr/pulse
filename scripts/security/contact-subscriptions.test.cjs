/* eslint-disable @typescript-eslint/no-require-imports -- Offline reader parity fixtures. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createHarness,HEAD,DEMO}=require('./synthetic-harness.cjs')
const url=`http://synthetic.invalid/api/contacts/student?tenant=${HEAD}`
const params={params:Promise.resolve({id:'student'})}
function scenario() {
 const enrollment=(id,fields={})=>({id,instrument:'Piano',instructor_person_id:'teacher',custom_fields:{status:'active',duration:45,level:2},...fields})
 return {actor:{access:{kind:'demo',tenantId:HEAD}},fixtures:{people:[
  {id:'student',tenant_id:HEAD,first_name:'Synthetic',students:[{id:'role',client_status:'active',enrollments:[
   enrollment('ended-native',{status:'ended'}),
   enrollment('ended-import',{status:'active',custom_fields:{status:'ended'}}),
   enrollment('booking',{plan_name:'Room booking'}),
   enrollment('current',{plan_name:'Monthly'}),
   enrollment('pending',{status:'pending',instructor_person_id:'former',custom_fields:{duration:30}}),
   enrollment('foreign',{instructor_person_id:'foreign',custom_fields:{instructor:'Historical name'}}),
  ]}]},
  {id:'teacher',tenant_id:HEAD,first_name:'Current',last_name:'Teacher'},
  {id:'former',tenant_id:HEAD,first_name:'Former',custom_fields:{staff_status:'sunset'}},
  {id:'foreign',tenant_id:DEMO,first_name:'Foreign'},
 ]}}
}
test('list, detail and post-edit responses share every current subscription and tenant-local teachers',async()=>{
 const h=createHarness(),base=scenario()
 const list=h.load('app/api/contacts/route.ts'),detail=h.load('app/api/contacts/[id]/route.ts')
 h.setScenario(base)
 const rows=await (await list.GET(new Request(url.replace('/student','')))).json()
 const expected=rows.find(row=>row.id==='student').profile_enrollments
 assert.deepEqual(expected.map(row=>row.id),['current','pending','foreign'])
 assert.deepEqual(expected.map(row=>row.instructor),['Current Teacher',null,null])
 assert.equal(expected[0].duration,45)
 assert.equal(expected[1].level,null)
 h.setScenario(base)
 const response=await detail.GET(new Request(url),params)
 assert.equal(response.status,200)
 const record=await response.json()
 assert.deepEqual(record.profile_enrollments,expected)
 assert.equal(record.custom_fields.plan_name,'Monthly')
 assert.equal(record.instructor.person_id,'teacher')
 assert.equal(h.getWrites().length,0)
 const teacherRead=h.getQueries().find(q=>q.table==='people'&&q.filters.some(f=>f[0]==='in'))
 assert.ok(teacherRead.filters.some(f=>f[0]==='eq'&&f[1]==='tenant_id'&&f[2]===HEAD))
 h.setScenario(base)
 const patched=await detail.PATCH(new Request(url,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({first_name:'Updated'})}),params)
 assert.equal(patched.status,200)
 assert.deepEqual((await patched.json()).profile_enrollments,expected)
 assert.ok(h.getWrites().every(q=>q.table==='people'))
})

test('legacy relation fallback keeps the subscription contract without staff joins',async()=>{
 const h=createHarness(),base=scenario()
 h.setScenario({...base,queryResult:query=>query.table==='people'&&query.filters.some(f=>f[0]==='select'&&f[1].includes('student_accounts'))?{data:null,error:{code:'PGRST200',message:'student_accounts unavailable'}}:undefined})
 const response=await h.load('app/api/contacts/[id]/route.ts').GET(new Request(url),params)
 assert.equal(response.status,200)
 assert.deepEqual((await response.json()).profile_enrollments.map(row=>row.id),['current','pending','foreign'])
 assert.ok(h.getQueries().every(q=>!q.filters.some(f=>f[0]==='select'&&f[1].includes('instructor:staff'))))
 assert.equal(h.getWrites().length,0)
})

test('instructor roster excludes either ended status and scopes enrollments to the tenant',async()=>{
 const h=createHarness(),base=scenario()
 base.fixtures.instructors=[{id:'staff',person_id:'student',tenant_id:HEAD}]
 const row=(id,status,tenant_id=HEAD)=>({id,status,tenant_id,instructor_person_id:'student',student:{client_status:'active',person:{id,name:'Student',first_name:'Synthetic'}}})
 base.fixtures.enrollments=[row('current','active'),row('ended','ended'),row('foreign','active',DEMO),{...row('import-ended','active'),custom_fields:{status:'ended'}}]
 h.setScenario(base)
 const response=await h.load('app/api/contacts/[id]/route.ts').GET(new Request(url),params)
 assert.equal(response.status,200)
 assert.deepEqual((await response.json()).active_students.map(row=>row.enrollment_id),['current'])
 assert.equal(h.getWrites().length,0)
})