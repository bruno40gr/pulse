const { test } = require('node:test')
const assert = require('node:assert/strict')
const { checkHostedApi } = require('./check-hosted-api.cjs')
const ref = 'abcdefghijklmnopqrst'
const env = {
  ODEON_API_CHECK_PROJECT_REF: ref,
  ODEON_API_CHECK_AUTHORIZE: `read-only:${ref}`,
  ODEON_API_CHECK_URL: `https://${ref}.supabase.co`,
  ODEON_API_CHECK_SERVICE_KEY: 'synthetic-not-a-secret',
}
test('authorized checks issue only bounded zero-row GETs and reject redirects', async () => {
  const calls = []
  const results = await checkHostedApi(env, async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => [] }
  })
  assert.equal(results.length, 4)
  for (const { url, options } of calls) {
    assert.equal(url.origin, `https://${ref}.supabase.co`)
    assert.equal(url.searchParams.get('limit'), '0')
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'error')
    assert.equal(options.body, undefined)
    assert.ok(!url.pathname.includes('rpc'))
  }
  assert.ok(calls[1].url.searchParams.get('select').includes('crm_contacts('))
})
test('missing authorization, mismatched project, URL credentials and absent key refuse before network', async () => {
  for (const change of [
    { ODEON_API_CHECK_AUTHORIZE: '' },
    { ODEON_API_CHECK_PROJECT_REF: 'wrong' },
    { ODEON_API_CHECK_URL: 'https://other.invalid' },
    { ODEON_API_CHECK_URL: `https://user:password@${ref}.supabase.co` },
    { ODEON_API_CHECK_SERVICE_KEY: '' },
  ]) {
    let called = false
    await assert.rejects(checkHostedApi({ ...env, ...change }, async () => { called = true }))
    assert.equal(called, false)
  }
})
test('upstream failures expose neither payloads nor transport secrets', async () => {
  let calls = 0
  await assert.rejects(checkHostedApi(env, async () => {
    calls++
    return { ok: false, status: 400, json: async () => { throw new Error('private payload') } }
  }), /^Error: Hosted API check failed for crm_contacts \(HTTP 400\)$/)
  assert.equal(calls, 1)
  await assert.rejects(checkHostedApi(env, async () => { throw new Error('private key') }),
    /^Error: Hosted API transport failed for crm_contacts$/)
})
test('unexpected rows and invalid JSON fail without printing their values', async () => {
  for (const json of [async () => [{ email: 'private@example.invalid' }],
    async () => { throw new Error('private response') }]) {
    await assert.rejects(checkHostedApi(env, async () => ({ ok: true, json })),
      error => !error.message.includes('private'))
  }
})