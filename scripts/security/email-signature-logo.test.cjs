/* eslint-disable @typescript-eslint/no-require-imports -- Isolated upload tests; no network or storage writes. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

function setup({ authorized = true, uploadError = false, missing = false } = {}) {
  const calls = []
  const storage = {
    getBucket: async () => { calls.push(['bucket']); return missing ? { error: { statusCode: 404 } } : { data: { public: true } } },
    createBucket: async (name, options) => { calls.push(['create', name, options]); return { error: null } },
    from: bucket => ({
      upload: async (key, bytes, options) => { calls.push(['upload', bucket, key, bytes, options]); return { error: uploadError ? new Error('failure') : null } },
      getPublicUrl: key => ({ data: { publicUrl: `https://storage.example.com/${bucket}/${key}` } }),
    }),
  }
  const loaded = { exports: {} }
  const dependencies = {
    'node:crypto': require('node:crypto'),
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/tenant-request': { authorizeTenantRequest: async () => authorized ? { ok: true, tenantId: 'tenant', context: { membershipId: 'mine' } } : { ok: false, status: 401, error: 'Sign in' } },
    '@/lib/supabase/admin': { supabaseAdmin: { storage } },
  }
  const source = fs.readFileSync(path.resolve(__dirname, '../../app/api/account/email-signoff/logo/route.ts'), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new vm.Script(code).runInNewContext({ Buffer, File, module: loaded, exports: loaded.exports, require: id => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency: ${id}`)
    return dependencies[id]
  } })
  return { route: loaded.exports, calls }
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII=', 'base64')
function request(bytes = png, type = 'image/png') {
  const form = new FormData()
  form.append('file', new File([bytes], '../../unsafe-name.png', { type }))
  return new Request('https://example.com/api/account/email-signoff/logo?tenant=tenant', { method: 'POST', body: form })
}

test('logo upload requires authentication before storage access', async () => {
  const { route, calls } = setup({ authorized: false })
  assert.equal((await route.POST(request())).status, 401)
  assert.equal(calls.length, 0)
})

test('logo upload rejects SVG, mismatched types, oversized and missing files', async () => {
  const { route, calls } = setup()
  for (const input of [request(Buffer.from('<svg/>'), 'image/svg+xml'), request(png, 'image/jpeg'), request(Buffer.alloc(2 * 1024 * 1024 + 1)), new Request('https://example.com', { method: 'POST', body: new FormData() })]) {
    assert.ok([400, 413].includes((await route.POST(input)).status))
  }
  assert.equal(calls.length, 0)
})

test('logo upload returns a public URL scoped to the tenant and member, never using the supplied filename', async () => {
  const { route, calls } = setup({ missing: true })
  const response = await route.POST(request())
  assert.equal(response.status, 200)
  assert.match(response.body.url, /^https:\/\/storage.example.com\/email-signature-logos\/tenant\/mine\/[a-f0-9]{64}\.png$/)
  assert.equal(calls.find(call => call[0] === 'create')[2].public, true)
  assert.equal(calls.find(call => call[0] === 'upload')[4].contentType, 'image/png')
})

test('storage failure never reports a successful logo upload', async () => {
  const { route } = setup({ uploadError: true })
  const response = await route.POST(request())
  assert.equal(response.status, 503)
  assert.equal(response.body.url, undefined)
})