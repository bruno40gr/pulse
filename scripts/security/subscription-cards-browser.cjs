/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic reader-to-card review; all network writes denied. */
const assert=require('node:assert/strict')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const {createHarness,HEAD}=require('./synthetic-harness.cjs')
const base=process.env.SUBSCRIPTION_CARDS_REVIEW_URL||'http://127.0.0.1:3262/odeon-demo/subscription-cards'
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('Local review only')
;(async()=>{
 const h=createHarness()
 h.setScenario({actor:{access:{kind:'demo',tenantId:HEAD}},fixtures:{people:[
  {id:'student',tenant_id:HEAD,first_name:'Synthetic',last_name:'Student',students:[{id:'role',client_status:'active',enrollments:[
   {id:'voice',instrument:'Voice',service_type:'private',plan_name:'Monthly',instructor_person_id:'teacher',custom_fields:{status:'active',duration:45,level:2}},
   {id:'piano',instrument:'Piano',service_type:'group',custom_fields:{status:'pending',duration:30}},
   {id:'ended',instrument:'Guitar',status:'ended',custom_fields:{duration:60}},
  ]}]},
  {id:'teacher',tenant_id:HEAD,first_name:'Current',last_name:'Teacher'},
 ]}})
 const response=await h.load('app/api/contacts/[id]/route.ts').GET(new Request(`http://synthetic.invalid/api/contacts/student?tenant=${HEAD}`),{params:Promise.resolve({id:'student'})})
 assert.equal(response.status,200)
 const record=await response.json()
 assert.equal(h.getWrites().length,0)
 const browser=await chromium.launch({channel:'chrome',headless:true})
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'})
   const page=await context.newPage(),errors=[],writes=[],unexpected=[]
   page.setDefaultTimeout(10000)
   page.on('pageerror',error=>errors.push(error.message))
   await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url())
    if(!['GET','HEAD'].includes(request.method())){writes.push(url.pathname);return route.abort()}
    if(url.origin!==new URL(base).origin)return route.abort()
    if(url.pathname.startsWith('/api/')){
     if(url.pathname==='/api/contacts/student')return route.fulfill({json:record})
     unexpected.push(url.pathname);return route.fulfill({json:[]})
    }
    return route.continue()
   })
   await page.goto(base,{waitUntil:'domcontentloaded'})
   await page.getByRole('heading',{name:'Voice • Level 2',exact:true}).waitFor()
   await page.getByText('Private • 45 min',{exact:true}).waitFor()
   await page.getByRole('heading',{name:'Piano',exact:true}).waitFor()
   await page.getByText('Group • 30 min',{exact:true}).waitFor()
   await page.getByText('Current Teacher',{exact:false}).last().waitFor()
   await page.getByText('Current teacher needs verification',{exact:true}).waitFor()
   assert.equal(await page.getByRole('heading',{name:/Guitar/}).count(),0)
   assert.equal(await page.getByRole('heading',{name:'Piano • Level 1',exact:true}).count(),0)
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(unexpected,[])
   console.log(`PASS ${width}: detail API projection renders stored duration, explicit/unknown levels and separate teacher identities; ended enrollment absent; no overflow or API writes`)
   await context.close()
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})