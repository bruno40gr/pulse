/* eslint-disable @typescript-eslint/no-require-imports -- Offline persistence contracts. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const h = createHarness()
const { academyWorkspaceKey: key, loadLocalAcademyWorkspace, saveLocalAcademyWorkspace } = h.load('beta-source/lib/academy-workspace-storage.ts')
const state = () => ({ snapshot: { data: {students: [], accounts: [], lessons: []}, makeups: {} }, setup: {teachers: [], locations: [], services: [], policies: []} })
const storage = () => { const map = new Map(); return { getItem: key => map.get(key) || null, setItem: (key,value) => map.set(key,value), removeItem: key => map.delete(key) } }
test('session workspace migrates once; durable data survives fresh sessions without stale overwrite', () => {
 const local=storage(), session=storage(); session.setItem(key,JSON.stringify(state()))
 assert.ok(loadLocalAcademyWorkspace(local,session)); assert.equal(session.getItem(key),null)
 const updated=state(); updated.setup.teachers=[{id:'teacher',values:{canPerformAdmin:'yes'}}]
 saveLocalAcademyWorkspace(local,updated); session.setItem(key,JSON.stringify(state()))
 assert.equal(loadLocalAcademyWorkspace(local,session).setup.teachers[0].values.canPerformAdmin,'yes')
 assert.equal(loadLocalAcademyWorkspace(local,storage()).setup.teachers.length,1)
})
test('corrupt and unavailable storage is explicit and not overwritten', () => {
 const local=storage(); local.setItem(key,'invalid')
 assert.throws(()=>loadLocalAcademyWorkspace(local,storage())); assert.equal(local.getItem(key),'invalid')
 assert.throws(()=>saveLocalAcademyWorkspace({setItem(){throw new Error('quota')}},state()),/quota/)
})
function scenario(permissions=['staff.read','staff.manage']) { return { authUser:{id:'auth'}, fixtures: { tenant_memberships:[{id:'member',tenant_id:HEAD,person_id:'person',auth_user_id:'auth',role_id:'role',status:'active'}],roles:[{id:'role',tenant_id:HEAD,key:'admin'}],role_permissions:permissions.map((_,i)=>({role_id:'role',permission_id:String(i)})), permissions:permissions.map((key,i)=>({id:String(i),key})),tenants:[{id:HEAD}] } } }
const request=(body,tenant=HEAD)=>new Request(`http://synthetic.invalid/api/academy/workspace?tenant=${tenant}`,body===undefined?undefined:{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
test('workspace denies anonymous and demo writes without database mutations',async()=>{
 const harness=createHarness(); const route=harness.load('app/api/academy/workspace/route.ts')
 harness.setScenario({}); assert.equal((await route.PUT(request({}))).status,401); assert.equal(harness.getWrites().length,0)
 harness.setScenario({actor:{access:{kind:'demo',tenantId:DEMO}}}); assert.equal((await route.PUT(request({},DEMO))).status,403); assert.equal(harness.getWrites().length,0)
})
test('workspace uses tenant-scoped load and revision-checked RPC; rejects samples and conflicts',async()=>{
 const harness=createHarness(); const route=harness.load('app/api/academy/workspace/route.ts')
 const base=scenario(); harness.setScenario({...base,fixtures:{...base.fixtures,academy_workspaces:[{tenant_id:HEAD,revision:4,state:state()}]}})
 assert.equal((await (await route.GET(request())).json()).revision,4)
 assert.ok(harness.getQueries().find(q=>q.table==='academy_workspaces').filters.some(f=>f[0]==='eq'&&f[1]==='tenant_id'&&f[2]===HEAD))
 harness.setScenario({...base,rpcResults:{save_academy_workspace:{revision:5}}})
 assert.equal((await route.PUT(request({revision:4,state:state()}))).status,200)
 const rpc=harness.getQueries().find(q=>q.table==='save_academy_workspace'); assert.equal(rpc.payload.p_tenant,HEAD); assert.equal(rpc.payload.p_revision,4)
 harness.setScenario({...base,rpcResults:{save_academy_workspace:{conflict:true,revision:5}}}); assert.equal((await route.PUT(request({revision:4,state:state()}))).status,409)
 const sample=state(); sample.snapshot.data.demoSchool=true; harness.setScenario(base)
 assert.equal((await route.PUT(request({revision:0,state:sample}))).status,400); assert.equal(harness.getWrites().length,0)
 harness.setScenario(scenario(['staff.read'])); assert.equal((await route.PUT(request({revision:0,state:state()}))).status,403)
})

test('migration restricts direct access and locks revisions before updating', () => {
 const fs=require('node:fs'), path=require('node:path')
 const sql=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/202611140001_academy_workspace.sql'),'utf8')
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/)
 assert.match(sql,/REVOKE ALL ON public.academy_workspaces FROM anon, authenticated/)
 assert.match(sql,/FOR UPDATE/)
 assert.match(sql,/current_revision <> p_revision/)
 assert.match(sql,/REVOKE ALL ON FUNCTION.*FROM PUBLIC, anon, authenticated/)
})
test('family makeup slots exclude persisted duties and release cancelled coverage', () => {
 const harness=createHarness()
 const {createDemoWorkspace}=harness.load('beta-source/lib/odeon-demo-workspace.ts')
 const {makeupSlots}=harness.load('beta-source/lib/academy-makeup-preview.ts')
 const {data}=createDemoWorkspace(), student=data.students[0], enrollment=student.enrollments[0]
 const makeup={id:'m',lessonId:'l',studentId:student.id,enrollmentId:enrollment.id,date:'2026-11-04',duration:enrollment.duration,program:enrollment.program,teacher:enrollment.teacher,service:enrollment.service}
 const slots=makeupSlots(data,{items:[],absences:[]},makeup,'2026-11-11',enrollment.program,false)
 assert.ok(slots.length>0)
 const target=slots[0]
 const blocked={...data,calendarBookings:[{id:'d',kind:'admin',teacherName:target.teacher,date:'2026-11-04',time:target.time,duration:enrollment.duration,repeat:'weekly',until:'2026-11-18',status:'Scheduled'}]}
 assert.ok(!makeupSlots(blocked,{items:[],absences:[]},makeup,target.date,enrollment.program,false).some(slot=>slot.time===target.time&&slot.teacher===target.teacher))
 blocked.calendarBookings[0].status='Cancelled'
 assert.ok(makeupSlots(blocked,{items:[],absences:[]},makeup,target.date,enrollment.program,false).some(slot=>slot.time===target.time&&slot.teacher===target.teacher))
})

test('HTML 404 and sign-in responses produce actionable errors instead of JSON syntax errors', async () => {
 const {readAcademyWorkspaceResponse}=h.load('beta-source/lib/academy-workspace-storage.ts')
 await assert.rejects(()=>readAcademyWorkspaceResponse(new Response('<!DOCTYPE html><html>Not found</html>',{status:404,headers:{'content-type':'text/html'}})),/not available on this preview/)
 await assert.rejects(()=>readAcademyWorkspaceResponse(new Response('<html>Sign in</html>',{status:200,headers:{'content-type':'text/html'}})),/sign in again/)
 await assert.rejects(()=>readAcademyWorkspaceResponse(Response.json({error:'Not authorized'},{status:403})),/Not authorized/)
 await assert.rejects(()=>readAcademyWorkspaceResponse(Response.json({revision:'bad'})),/invalid revision/)
 assert.equal((await readAcademyWorkspaceResponse(Response.json({revision:3,state:null}))).revision,3)
})
