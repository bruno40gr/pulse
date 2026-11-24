/* eslint-disable @typescript-eslint/no-require-imports -- Local default-off UI review; all API traffic intercepted. */
const assert=require('node:assert/strict')
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=process.env.STAFF_RELEASE_GATE_REVIEW_URL||'http://127.0.0.1:3262/odeon-demo/staff-release-gate'
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('Local fixtures only')
;(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true})
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'})
   const page=await context.newPage(),writes=[],profileRequests=[],errors=[]
   page.setDefaultTimeout(10000)
   page.on('pageerror',error=>errors.push(error.message))
   await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url())
    if(!['GET','HEAD'].includes(request.method())){writes.push(url.pathname);return route.abort()}
    if(url.origin!==new URL(base).origin)return route.abort()
    if(url.pathname.startsWith('/api/')){
     if(url.pathname==='/api/staff/work-profile')profileRequests.push(url.pathname)
     if(url.pathname==='/api/staff')return route.fulfill({json:[{id:'staff',person_id:'person',first_name:'Synthetic',last_name:'Teacher',is_active:true}]})
     if(url.pathname==='/api/contacts/person')return route.fulfill({json:{id:'person',first_name:'Synthetic',last_name:'Teacher',staff_id:'staff',is_active:true,client_status:'active',custom_fields:{contact_kind:'instructor'},active_students:[]}})
     return route.fulfill({json:[]})
    }
    return route.continue()
   })
   // Even a legacy deep link must not open or fetch the disabled editor.
   await page.goto(`${base}?person=person`,{waitUntil:'domcontentloaded'})
   await page.getByText('Synthetic Teacher',{exact:true}).click()
   await page.getByRole('dialog').waitFor()
   assert.equal(await page.getByRole('button',{name:'Qualifications & availability',exact:true}).count(),0)
   assert.equal(await page.getByText('Loading staff work profile',{exact:true}).count(),0)
   assert.deepEqual(profileRequests,[]);assert.deepEqual(writes,[]);assert.deepEqual(errors,[])
   console.log(`PASS ${width}: operational roster/contact remain available; work-profile action and legacy deep link disabled; no profile requests or network writes`)
   await context.close()
  }
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1})