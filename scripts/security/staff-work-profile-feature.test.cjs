/* eslint-disable @typescript-eslint/no-require-imports -- Offline release gate regressions. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {createHarness,HEAD}=require('./synthetic-harness.cjs')
test('operational editing defaults off and only accepts explicit opt-in without server veto',()=>{
 for(const [env,expected] of [[{},false],[{ENABLE_STAFF_WORK_PROFILE:'true'},false],[{NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE:'false'},false],[{NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE:'true'},true],[{NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE:'true',ENABLE_STAFF_WORK_PROFILE:'false'},false]]){
  const h=createHarness();h.setScenario({env});assert.equal(h.load('lib/staff-work-profile-feature.ts').staffWorkProfileEnabled(),expected)
 }
})
test('disabled work-profile GET and PUT deny before database reads, even with storage or client opt-in',async()=>{
 for(const env of [{},{NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE:'true',ENABLE_STAFF_WORK_PROFILE:'false'}]){
  const h=createHarness()
  h.setScenario({env,fixtures:{academy_workspaces:[{tenant_id:HEAD,revision:0,state:{}}]}})
  const route=h.load('app/api/staff/work-profile/route.ts')
  for(const method of ['GET','PUT']){
   const response=await route[method](new Request(`https://synthetic.invalid/api/staff/work-profile?tenant=${HEAD}&person=10000000-0000-0000-0000-000000000001`,{method,...(method==='PUT'?{body:'{}'}:{})}))
   assert.equal(response.status,503)
  }
  assert.equal(h.getQueries().length,0)
 }
})