// Reads production only. Writes sanitized private artifacts; never applies SQL.
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');
const { TABLES, sanitizeSnapshot } = require('./sanitize-snapshot.cjs');
const { importSql, addEdgeCases } = require('./refresh-sql.cjs');
function env(file) {
  return Object.fromEntries(fs.readFileSync(file,'utf8').split('\n').filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{ const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).trim().replace(/^['"]|['"]$/g,'')]; }));
}
async function main() {
  const output = process.argv[2];
  if (!output || !path.isAbsolute(output) || !output.startsWith('/Users/brunowong/odeon-private/staging/')) throw Error('Private staging output directory required');
  const e = env('/Users/brunowong/pulse/.env.local');
  if (e.NEXT_PUBLIC_SUPABASE_URL !== 'https://jbrntsxmibfldocsuslt.supabase.co' || e.CRM_SUPABASE_URL !== e.NEXT_PUBLIC_SUPABASE_URL) throw Error('Unexpected source targets');
  const client = createClient(e.NEXT_PUBLIC_SUPABASE_URL,e.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const snapshot = {};
  for (const table of ['tenants',...TABLES]) {
    snapshot[table] = [];
    for (let offset=0;;offset+=500) {
      const {data,error}=await client.from(table).select('*').order('id').range(offset,offset+499);
      if(error)throw Error(`Read failed: ${table} (${error.code})`);
      snapshot[table].push(...data); if(data.length<500)break;
    }
  }
  // The API cannot provide a transaction-wide snapshot; FK validation in the
  // rehearsal/import rejects inconsistent reads instead of silently fixing them.
  const sanitized = sanitizeSnapshot(snapshot,randomBytes(32).toString('hex'));
  addEdgeCases(sanitized);
  fs.mkdirSync(output,{recursive:true,mode:0o700});
  fs.writeFileSync(path.join(output,'sanitized-snapshot.json'),JSON.stringify(sanitized),{mode:0o600});
  fs.writeFileSync(path.join(output,'refresh.sql'),importSql(sanitized),{mode:0o600});
  const counts=Object.fromEntries(Object.entries(sanitized).map(([t,rows])=>[t,rows.length]));
  fs.writeFileSync(path.join(output,'counts.json'),JSON.stringify(counts,null,2),{mode:0o600});
  console.log(JSON.stringify(counts,null,2));
  console.log('SANITIZED FILES PREPARED; NO DATABASE WRITES');
}
if(require.main===module)main().catch(()=>{console.error('Refresh preparation failed; inspect configuration and retry read-only preparation.');process.exitCode=1;});