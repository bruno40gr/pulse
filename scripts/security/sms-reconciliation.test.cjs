const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
function load(file, dependencies, fetch, env = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, require: id => {
    if (id === 'node:crypto') return require(id);
    assert.ok(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id];
  }, URL, URLSearchParams, Buffer, Date, AbortSignal, fetch, process: { env }, console: { error() {} } });
  return module.exports;
}
function setup({ outcome = 'saved', fail = false, next = null } = {}) {
  const writes = [];
  const db = { from(table) {
    let value;
    const b = { select() { return b; }, eq() { return b; }, single() { return Promise.resolve({
      data: { started_at: '2026-10-01T00:00:00Z', last_success_at: null }, error: null,
    }); }, update(v) { value = v; writes.push({ table, value }); return b; },
    then(resolve) { return Promise.resolve({ data: value ? null : [{ tenant_id: 'school', account_sid: 'ACtest', auth_token: 'synthetic', phone_number: '+12025550122' }], error: null }).then(resolve); } };
    return b;
  }, async rpc(name, payload) { writes.push({ name, payload }); return { data: outcome, error: fail ? {} : null }; } };
  const urls = [];
  const fetch = async url => { urls.push(String(url)); return { ok: true, json: async () => ({ next_page_uri: next, messages: [
    { sid: 'SMtest', direction: 'inbound', from: '+12025550111', to: '+12025550122', body: 'Synthetic', date_sent: '2026-10-02T00:00:00Z' },
    { sid: 'wrong-number', direction: 'inbound', to: '+12025550999', date_sent: '2026-10-02T00:00:00Z' },
    { sid: 'old-deletion', direction: 'inbound', to: '+12025550122', date_sent: '2026-09-01T00:00:00Z' },
  ] }) }; };
  return { lib: load('lib/sms-reconciliation.ts', { '@/lib/supabase/admin': { supabaseAdmin: db } }, fetch), writes, urls };
}
test('recovery saves only eligible inbound messages and advances checkpoint', async () => {
  const { lib, writes } = setup();
  const result = await lib.reconcileInboundSms();
  assert.equal(result.recovered, 1); assert.equal(result.checked, 1);
  assert.equal(writes.filter(w => w.name).length, 1);
  assert.equal(writes.find(w => w.name).payload.p_received_at, '2026-10-02T00:00:00.000Z');
  assert.ok(writes.at(-1).value.last_success_at);
});
test('deleted and existing replies never count as recovered', async () => {
  for (const outcome of ['deleted','existing']) {
    const { lib } = setup({ outcome }); assert.equal((await lib.reconcileInboundSms()).recovered, 0);
  }
});
test('failed recovery does not advance success checkpoint or leak message text', async () => {
  const { lib, writes } = setup({ fail: true });
  await assert.rejects(lib.reconcileInboundSms(), /SMS reconciliation failed/);
  assert.equal(writes.at(-1).value.last_success_at, undefined);
});
test('provider pagination cannot exfiltrate credentials', async () => {
  const { lib } = setup();
  for (const url of ['https://evil.invalid/x','https://api.twilio.com/other','https://user@api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json']) {
    assert.throws(() => lib.providerPageUrl(url,'ACtest'));
  }
});
test('atomic throttle skips recent claims without provider requests', async () => {
  let fetches = 0;
  const db = { from(table) {
    const b = { select() { return b; }, eq() { return b; }, update() { return b; }, or() { return b; },
      then(resolve) { return Promise.resolve({ error: null, data: table === 'twilio_config'
        ? [{ tenant_id: 'school' }] : [] }).then(resolve); } };
    return b;
  } };
  const lib = load('lib/sms-reconciliation.ts', { '@/lib/supabase/admin': { supabaseAdmin: db } }, async () => { fetches++; });
  assert.equal((await lib.reconcileInboundSms('school', true)).checked, 0);
  assert.equal(fetches, 0);
});
test('session check requires origin and permission, and scopes recovery', async () => {
  let access = { ok: true, tenantId: 'school' };
  const runs = [];
  const deps = {
    'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } },
    '@/lib/tenant-request': { authorizeTenantRequest: async (_request, options) => {
      assert.equal(options.permission, 'communications.read'); assert.equal(options.allowDemo, undefined); return access;
    } },
    '@/lib/permissions': { PERMISSIONS: { communicationsRead: 'communications.read' } },
    '@/lib/sms-reconciliation': { reconcileInboundSms: async (...args) => { runs.push(args); return { checked: 0, recovered: 0 }; } },
  };
  const route = load('app/api/inbox/reconcile/route.ts', deps);
  const request = origin => new Request('https://app.test/api/inbox/reconcile', { method: 'POST', headers: { origin } });
  assert.equal((await route.POST(request('https://evil.test'))).status, 403);
  access = { ok: false, status: 401, error: 'Unauthorized' };
  assert.equal((await route.POST(request('https://app.test'))).status, 401);
  assert.equal(runs.length, 0);
  access = { ok: true, tenantId: 'school' };
  assert.equal((await route.POST(request('https://app.test'))).status, 200);
  assert.deepEqual(Array.from(runs[0]), ['school', true]);
});
test('scheduler endpoint refuses missing, weak and non-ASCII invalid secrets', async () => {
  let runs = 0;
  const response = { json: (body, options) => ({ body, status: options?.status || 200 }) };
  const dependencies = { 'next/server': { NextResponse: response }, '@/lib/sms-reconciliation': { reconcileInboundSms: async () => { runs++; return { checked: 1, recovered: 0 }; } } };
  const route = load('app/api/internal/sms-reconcile/route.ts', dependencies, null, { SMS_RECONCILIATION_SECRET: 'a'.repeat(32) });
  for (const authorization of ['', 'Bearer wrong', 'Bearer '+'é'.repeat(32)]) {
    const result = await route.GET(new Request('https://example.invalid',{headers:{ authorization }}));
    assert.equal(result.status, 401);
  }
  assert.equal(runs,0);
  assert.equal((await route.GET(new Request('https://example.invalid',{headers:{authorization:'Bearer '+'a'.repeat(32)}}))).status,200);
  assert.equal(runs,1);
});