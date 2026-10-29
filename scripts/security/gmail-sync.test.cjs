/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic sync execution without network or database access. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname,'../..')
const tenant = '00000000-0000-0000-0000-000000000001'

function setup({ ambiguous = false, unrelated = false, failWrite = false, busy = false, bulk = false, nextPage = false, status = 'new', siblingStatus = status, Clock = Date, onProvider, onDatabase, staleFinish = false } = {}) {
  const receipts = []; const records = []; const updates = []; const queries = []; const providerCalls = []
  const connection = { id:'mailbox',tenant_id:tenant,email:'office@example.com',refresh_token_ciphertext:'encrypted',connected_by:'admin',capture_from:'2026-10-01T00:00:00Z',last_synced_at:null,sync_until:'2026-10-14T12:00:00Z',page_token:null,sync_lease_token:'lease' }
  const leads = [{ id:'lead1',contact_id:'contact1',intake_type:'lesson_inquiry',status,created_at:'2026-10-01T00:00:00Z',payload:{},crm_contacts:{email:'parent@example.com'} }]
  if (ambiguous) leads.push({...leads[0],id:'lead2',status:siblingStatus})
  const db = {
    async rpc(name,args) {
      await onDatabase?.(name)
      if (name === 'gmail_finish_sync') {
        assert.equal(args.p_lease,'lease');assert.equal(args.p_tenant,tenant)
        if (staleFinish && args.p_success) return {data:false}
        updates.push(args.p_success ? {page_token:args.p_page,sync_until:args.p_page?connection.sync_until:null,...(args.p_page?{}:{last_synced_at:connection.sync_until})} : {lease_until:null,last_error:'failed'})
        return {data:true}
      }
      if (name === 'gmail_claim_sync') return { data: busy ? [] : [connection],error:null }
      if (name === 'gmail_record_outreach') {
        if (failWrite) return { error: {message:'Synthetic failure'} }
        const receipt=receipts.find(item=>item.id===args.p_message)
        if(receipt.status!=='recorded'){records.push(args);receipt.status='recorded'}
        return {data:receipt.event_id,error:null}
      }
      throw new Error('Unexpected RPC')
    },
    from(table) {
      let operation='select',payload,filters=[],inFilters=[]
      const result=async()=>{
        await onDatabase?.(table)
        queries.push({table,operation,filters,inFilters,payload})
        if(table==='lead_intakes')return {data:leads.filter(row=>inFilters.every(([key,values])=>values.includes(row[key]))),error:null}
        if(table==='gmail_connections'){updates.push(payload);return {data:null,error:null}}
        if(table==='gmail_outreach') {
          if(operation==='insert'){const row={...payload,id:`receipt${receipts.length}`,status:'review',event_id:'event'};receipts.push(row);return {data:row,error:null}}
          return {data:receipts.find(item=>filters.every(([key,value])=>item[key]===value))||null,error:null}
        }
        throw new Error('Unexpected table')
      }
      let builder
      builder=new Proxy({}, { get(_,method){ if(method==='then')return (resolve,reject)=>Promise.resolve(result()).then(resolve,reject);return (...args)=>{if(['insert','update'].includes(method)){operation=method;payload=args[0]}if(method==='eq')filters.push(args);if(method==='in')inFilters.push(args);return builder} } })
      return builder
    },
  }
  const cache=new Map()
  function load(file){
    if(cache.has(file))return cache.get(file)
    const loaded={exports:{}}
    const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
    const context=vm.createContext({module:loaded,exports:loaded.exports,Buffer,Intl,Date:Clock,URLSearchParams,console,process:{env:{}},require(id){
      if(id==='node:crypto')return require(id)
      if(id==='@/lib/supabase/crm-admin')return {crmSupabaseAdmin:db}
      if(id==='./security')return {decryptToken:()=> 'synthetic-refresh-token'}
      if(id==='./google')return {googleToken:async(_,deadline)=>{providerCalls.push(['token',deadline]);onProvider?.('token');return {access_token:'synthetic'}},gmailGet:async(_,url,deadline)=>{
        providerCalls.push([url,deadline]);onProvider?.(url)
        if(url.startsWith('messages?'))return {messages:[{id:'gmail1'}],...(nextPage?{nextPageToken:'next'}:{})}
        return {id:'gmail1',internalDate:String(Date.parse('2026-10-14T10:00:00Z')),labelIds:['SENT'],payload:{mimeType:'text/plain',body:{data:Buffer.from('Your trial lesson is confirmed for Tuesday at 4 PM.').toString('base64url')},headers:[{name:'To',value:bulk?Array.from({length:6},(_,i)=>`person${i}@example.com`).join(','):unrelated?'unrelated@example.com':'parent@example.com'},{name:'From',value:'Office <office@example.com>'},{name:'Message-ID',value:'<unique@example.com>'}]}}
      }
      }
      if(id==='./rules')return load('lib/gmail/rules.ts')
      throw new Error(`Blocked dependency ${id}`)
    }})
    new vm.Script(code).runInContext(context);cache.set(file,loaded.exports);return loaded.exports
  }
  return {sync:load('lib/gmail/sync.ts').syncMailbox,receipts,records,updates,queries,leads,providerCalls}
}

test('sync captures dated quote once across repeated syncs',async()=>{
  const h=setup();await h.sync(tenant,'mailbox');await h.sync(tenant,'mailbox')
  assert.equal(h.receipts.length,1);assert.equal(h.records.length,1)
  assert.equal(h.records[0].p_tenant,tenant);assert.equal(h.records[0].p_decision,'booked')
  assert.ok(h.records[0].p_note.startsWith('Email sent on Oct 14, 2026'))
  assert.ok(h.queries.every(query=>query.operation === 'insert' ? query.payload.tenant_id === tenant : query.filters.some(([key,value])=>key==='tenant_id'&&value===tenant)))
})
test('ambiguous inquiries remain in review and do not receive notes',async()=>{
  const h=setup({ambiguous:true});const result=await h.sync(tenant,'mailbox')
  assert.equal(result.review,1);assert.equal(h.records.length,0);assert.equal(h.receipts[0].candidate_lead_ids.length,2)
})
for(const status of ['processing','won','enrolled'])test(`sync captures ${status} correspondence once and retains lead/contact identity`,async()=>{
  const h=setup({status});await h.sync(tenant,'mailbox');await h.sync(tenant,'mailbox')
  assert.equal(h.receipts.length,1);assert.equal(h.records.length,1)
  assert.equal(h.records[0].p_lead,'lead1');assert.equal(h.leads[0].contact_id,'contact1')
  assert.equal(h.leads[0].status,status)
  assert.ok(h.queries.find(query=>query.table==='lead_intakes').inFilters.some(([key,values])=>key==='status'&&values.includes(status)))
})
test('capture remains deduplicated when a previously captured lead converts',async()=>{
  const h=setup();await h.sync(tenant,'mailbox');h.leads[0].status='won';await h.sync(tenant,'mailbox')
  assert.equal(h.receipts.length,1);assert.equal(h.records.length,1);assert.equal(h.leads[0].contact_id,'contact1')
})
test('converted and active inquiries sharing an address remain ambiguous',async()=>{
  const h=setup({ambiguous:true,status:'processing',siblingStatus:'new'});const result=await h.sync(tenant,'mailbox')
  assert.equal(result.review,1);assert.equal(h.records.length,0);assert.equal(h.receipts[0].candidate_lead_ids.length,2)
})
for(const status of ['lost','spam','ghosted_us'])test(`sync still excludes ${status} leads`,async()=>{
  const h=setup({status});await h.sync(tenant,'mailbox');assert.equal(h.receipts.length,0)
})
for(const options of [{unrelated:true},{bulk:true}])test(`unrelated and bulk mail is not persisted: ${JSON.stringify(options)}`,async()=>{
  const h=setup(options);await h.sync(tenant,'mailbox');assert.equal(h.receipts.length,0)
})
test('failed note transaction retains receipt and does not advance cursor',async()=>{
  const h=setup({failWrite:true});await assert.rejects(()=>h.sync(tenant,'mailbox'))
  assert.equal(h.receipts[0].status,'review');assert.equal(h.records.length,0)
  assert.ok(h.updates[0].last_error);assert.equal(h.updates[0].last_synced_at,undefined)
})
test('concurrent lease causes no processing',async()=>{
  const h=setup({busy:true});assert.equal((await h.sync(tenant,'mailbox')).busy,true);assert.equal(h.receipts.length,0)
})
test('pagination preserves window until all pages complete',async()=>{
  const h=setup({nextPage:true});await h.sync(tenant,'mailbox')
  assert.equal(h.updates[0].page_token,'next');assert.equal(h.updates[0].sync_until,'2026-10-14T12:00:00Z');assert.equal(h.updates[0].last_synced_at,undefined)
})

test('legacy sync passes one shrinking wall-clock deadline to token, list and message reads',async()=>{
  class Clock extends Date { static now() { return 100000 } }
  const h=setup({Clock});await h.sync(tenant,'mailbox',30000)
  assert.equal(h.providerCalls.length,3)
  assert.ok(h.providerCalls.every(([,deadline])=>deadline===127000))
})

test('expired legacy provider work retains its cursor and releases its lease',async()=>{
  let now=100000
  class Clock extends Date { static now() { return now } }
  const h=setup({Clock,onProvider(url){if(url.startsWith('messages?'))now=127000}})
  await assert.rejects(()=>h.sync(tenant,'mailbox',30000))
  assert.equal(h.providerCalls.length,2)
  assert.equal(h.receipts.length,0)
  assert.equal(h.updates[0].lease_until,null)
  assert.equal(h.updates[0].page_token,undefined)
  assert.ok(h.updates[0].last_error)
})

for(const stage of ['gmail_claim_sync','lead_intakes'])test(`legacy database delay at ${stage} does not advance coverage`,async()=>{
  let now=100000
  class Clock extends Date { static now(){return now} }
  const h=setup({Clock,onDatabase(name){if(name===stage)now=130000}})
  await assert.rejects(()=>h.sync(tenant,'mailbox',30000))
  assert.equal(h.updates[0].last_synced_at,undefined)
  assert.ok(h.updates[0].last_error)
  assert.equal(h.providerCalls.length,stage==='gmail_claim_sync'?0:1)
})

test('legacy stale completion cannot publish a successful cursor',async()=>{
  const h=setup({staleFinish:true})
  await assert.rejects(()=>h.sync(tenant,'mailbox',30000))
  assert.equal(h.updates.length,1)
  assert.equal(h.updates[0].last_synced_at,undefined)
})