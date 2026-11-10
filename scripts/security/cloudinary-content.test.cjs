/* eslint-disable @typescript-eslint/no-require-imports -- Offline provider-contract tests. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { createHarness } = require('./synthetic-harness.cjs')
function library(env = {}) {
  const h = createHarness()
  h.setScenario({ env: { CLOUDINARY_CLOUD_NAME: 'synthetic-cloud', CLOUDINARY_API_KEY: 'synthetic-key', CLOUDINARY_API_SECRET: 'synthetic-secret', ...env } })
  return h.load('lib/cloudinary-content.ts')
}
test('configuration fails closed and signatures sort parameters with SHA-256', () => {
  assert.throws(() => library({ CLOUDINARY_API_SECRET: '' }).cloudinaryConfiguration())
  assert.equal(library().cloudinarySignature({ z: '2', a: '1' }, 'secret'), createHash('sha256').update('a=1&z=2secret').digest('hex'))
})
test('uploads use authenticated Cloudinary assets and server-signed bounded requests', async () => {
  const lib = library()
  const result = await lib.uploadContentImage(new Uint8Array([1,2,3]), 'image/png', 'odeon/website/tenant/id', async (url, options) => {
    assert.equal(url, 'https://api.cloudinary.com/v1_1/synthetic-cloud/image/upload')
    assert.equal(options.method, 'POST')
    assert.equal(options.redirect, 'error')
    assert.equal(options.body.get('type'), 'authenticated')
    assert.equal(options.body.get('overwrite'), 'false')
    assert.equal(options.body.get('api_secret'), null)
    assert.equal(options.body.get('api_key'), 'synthetic-key')
    assert.equal(options.body.get('file').type, 'image/png')
    return Response.json({ public_id: 'odeon/website/tenant/id', resource_type: 'image', type: 'authenticated', asset_id: 'asset', format: 'png' })
  })
  assert.equal(result.assetId, 'asset')
})
test('unexpected provider responses and failures cannot attach images', async () => {
  const lib = library()
  await assert.rejects(lib.uploadContentImage(new Uint8Array([1]), 'image/png', 'target', async () => Response.json({ public_id: 'another-id' })))
  await assert.rejects(lib.uploadContentImage(new Uint8Array([1]), 'image/png', 'target', async () => new Response('private provider details', { status: 401 })), /could not complete/)
})
test('authenticated downloads use immutable asset ID and expire without exposing signatures', async () => {
  const lib = library()
  const response = await lib.downloadContentImage('asset', async (url, options) => {
    assert.equal(url, 'https://api.cloudinary.com/v1_1/synthetic-cloud/asset/download')
    assert.equal(options.body.get('asset_id'), 'asset')
    assert.ok(Number(options.body.get('expires_at')) > Date.now() / 1000)
    return new Response(new Uint8Array([1,2,3]), { headers: { 'content-type': 'image/png' } })
  })
  assert.equal(response.headers.get('content-type'), 'image/png')
  await assert.rejects(lib.downloadContentImage('asset', async () => new Response('{}', { headers: { 'content-type': 'application/json' } })))
})