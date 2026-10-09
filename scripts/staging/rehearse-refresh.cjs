// Applies the exact sanitized file in a disposable, network-isolated database.
const fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const docker='/Applications/Docker.app/Contents/Resources/bin/docker';
const baseline='/Users/brunowong/odeon-private/staging/baseline';
const refresh='/Users/brunowong/odeon-private/staging/refresh';
const name=`odeon-staging-refresh-${process.pid}`;
const run=(args,input)=>execFileSync(docker,args,{input,encoding:'utf8',timeout:120000,stdio:['pipe','pipe','pipe']});
const sql=text=>run(['exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],text).trim();
try {
 run(['run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
 let ready=false;for(let i=0;i<60;i++){try{run(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);}}assert.ok(ready);
 sql(fs.readFileSync(baseline+'/local-fixture.sql','utf8'));
 sql(fs.readFileSync(baseline+'/install-staging-schema.sql','utf8'));
 sql(fs.readFileSync(baseline+'/seed-staging.sql','utf8'));
 const script=fs.readFileSync(refresh+'/refresh.sql','utf8');
 sql(script);
 const counts=JSON.parse(fs.readFileSync(refresh+'/counts.json','utf8'));
 for(const [table,count]of Object.entries(counts))assert.equal(Number(sql(`SELECT count(*) FROM public.${table};`)),count+(table==='people'?2:0));
 assert.equal(sql('SELECT count(*) FROM public.twilio_config;'),'0');
 assert.equal(sql('SELECT count(*) FROM public.tenant_memberships;'),'2');
 assert.equal(sql("SELECT count(*) FROM pg_trigger WHERE tgrelid='public.lead_intakes'::regclass AND tgenabled='D';"),'0');
 sql(script); // A second refresh must remain repeatable, including tombstones.
 assert.equal(Number(sql('SELECT count(*) FROM public.messages;')),counts.messages);
 sql("INSERT INTO public.twilio_config(tenant_id) VALUES('00000000-0000-0000-0000-000000000001');");
 assert.throws(()=>sql(script));
 assert.equal(Number(sql('SELECT count(*) FROM public.messages;')),counts.messages);
 console.log('PASS: exact import, row comparisons, FK integrity, synthetic login preservation, repeat refresh, environment guard and rollback.');
}catch(error){
 // Import contains sanitized values only; keep detailed diagnostics private.
 fs.writeFileSync(refresh+'/rehearsal-error.log',String(error.stderr||error.message),{mode:0o600});
 console.error('Rehearsal failed; sanitized diagnostic saved privately.');process.exitCode=1;
}finally{run(['rm','-fv',name]);}