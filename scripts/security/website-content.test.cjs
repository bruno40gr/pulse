/* eslint-disable @typescript-eslint/no-require-imports -- Built-in synthetic runner. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const ID = '00000000-0000-0000-0000-000000000005'
const OTHER = '00000000-0000-0000-0000-000000000004'
const base = { id: ID, kind: 'article', title: 'New story', body: 'A story.', image: 'https://res.cloudinary.com/diy08lj9x/image/upload/sample.jpg', imageAlt: 'Academy photo' }
function scenario(role = 'admin', tenant = HEAD) {
  return { authUser: { id: 'auth' }, fixtures: {
    tenant_memberships: [{ id: 'membership', tenant_id: tenant, person_id: 'staff', auth_user_id: 'auth', role_id: 'role', status: 'active' }],
    roles: [{ id: 'role', tenant_id: tenant, key: role }], role_permissions: [], permissions: [],
  }, rpcResults: { website_content_workspace: { revision: 0, items: [] }, website_content_command: { revision: 1, items: [] } } }
}
const request = (body, origin = 'http://synthetic.invalid') => new Request(`http://synthetic.invalid/api/website-content?tenant=${HEAD}`, body ? { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})

for (const [name, config, status] of [
  ['anonymous', {}, 401], ['staff', scenario('staff'), 403], ['other academy', scenario('admin', OTHER), 403],
  ['demo', { actor: { displayName: 'Demo', access: { kind: 'demo', tenantId: DEMO } } }, 403],
]) test(`${name} cannot read, upload or mutate website content`, async () => {
  const h = createHarness(); h.setScenario(config)
  const route = h.load('app/api/website-content/route.ts')
  assert.equal((await route.GET(request())).status, status)
  assert.equal((await route.POST(request({ action: 'publish', revision: 0, item: base }))).status, status)
  assert.equal((await h.load('app/api/website-content/assets/route.ts').POST(request({}))).status, status)
  assert.equal(h.getQueries().filter(q => q.operation === 'rpc').length, 0)
})
test('admin publish uses verified tenant, actor and strips forged metadata', async () => {
  const h = createHarness(); h.setScenario(scenario())
  const response = await h.load('app/api/website-content/route.ts').POST(request({ action: 'publish', revision: 0, item: { ...base, publishedAt: '2000-01-01', hasPublishedVersion: true, tenant_id: OTHER } }))
  assert.equal(response.status, 200)
  const rpc = h.getQueries().find(q => q.operation === 'rpc')
  assert.equal(rpc.payload.p_tenant, HEAD)
  assert.equal(rpc.payload.p_actor, 'membership')
  assert.equal(rpc.payload.p_item.publishedAt, '')
  assert.equal(rpc.payload.p_item.tenant_id, undefined)
})
test('cross-origin writes are rejected before domain calls', async () => {
  const h = createHarness(); h.setScenario(scenario())
  assert.equal((await h.load('app/api/website-content/route.ts').POST(request({ action: 'save', revision: 0, item: base }, 'https://evil.test'))).status, 403)
  assert.equal(h.getQueries().length, 0)
})
test('stale saves return conflict; database details stay private', async () => {
  const h = createHarness(); h.setScenario({ ...scenario(), rpcErrors: { website_content_command: { code: '40001', message: 'secret database detail' } } })
  const response = await h.load('app/api/website-content/route.ts').POST(request({ action: 'save', revision: 0, item: base }))
  assert.equal(response.status, 409)
  assert.ok(!JSON.stringify(await response.json()).includes('secret database detail'))
})
test('publication validation rejects templates, social, embedded images and cross-tenant assets', () => {
  const { contentCommand, assetPath } = createHarness().load('lib/website-content.ts')
  const publish = item => contentCommand({ action: 'publish', revision: 0, item }, HEAD)
  for (const item of [{ ...base, image: 'data:image/png;base64,test' }, { ...base, image: assetPath(OTHER, ID) }, { ...base, kind: 'social' }, { ...base, kind: 'announcement', artwork: 'template' }]) assert.throws(() => publish(item))
  assert.equal(publish(base).item.slug, `new-story-${ID.slice(0, 8)}`)
  assert.throws(() => contentCommand({ action: 'save', revision: -1, item: base }, HEAD))
})
test('event times use Pacific DST and reject nonexistent wall times', () => {
  const { academyInstant } = createHarness().load('lib/website-content.ts')
  assert.equal(academyInstant('2026-07-01', '18:00'), '2026-07-02T01:00:00.000Z')
  assert.equal(academyInstant('2026-12-01', '18:00'), '2026-12-02T02:00:00.000Z')
  assert.throws(() => academyInstant('2026-03-08', '02:30'))
})
test('uploaded file details survive command validation without entering the public feed', () => {
  const h = createHarness()
  const { contentCommand } = h.load('lib/website-content.ts')
  const file = { imageFileName: 'Academy photo.png', imageFileType: 'image/png', artworkFileName: 'Flyer.webp', artworkFileType: 'image/webp' }
  const { item } = contentCommand({ action: 'save', revision: 0, item: { ...base, ...file } }, HEAD)
  for (const [key, value] of Object.entries(file)) assert.equal(item[key], value)
  for (const metadata of [{ imageFileName: 12 }, { imageFileName: 'a'.repeat(256) }, { imageFileType: 'text/html' }, { artworkFileType: [] }]) {
    assert.throws(() => contentCommand({ action: 'save', revision: 0, item: { ...base, ...metadata } }, HEAD))
  }
  const { publicContentRecord } = h.load('lib/website-content-public.ts')
  const record = publicContentRecord({ id: ID, slug: 'story', published: item, published_at: '2026-11-10' }, HEAD, 'https://crm.test')
  for (const key of Object.keys(file)) assert.equal(record[key], undefined)
})
test('website reader requires strong matching token and projects only public fields', () => {
  const h = createHarness(); h.setScenario({ env: { WEBSITE_CONTENT_READ_TOKEN: 'a'.repeat(40) } })
  const { websiteReaderAuthorized, publicContentRecord } = h.load('lib/website-content-public.ts')
  assert.equal(websiteReaderAuthorized(new Request('https://example.test')), false)
  assert.equal(websiteReaderAuthorized(new Request('https://example.test', { headers: { authorization: `Bearer ${'a'.repeat(40)}` } })), true)
  const value = publicContentRecord({ id: ID, slug: 'story', published_at: '2026-11-09', published: { ...base, summary: 'Summary', permission: true, styleReferences: [{ image: 'private' }] } }, HEAD, 'https://crm.test')
  assert.equal(value.body[0].text, 'A story.')
  assert.equal(value.styleReferences, undefined)
  assert.equal(value.permission, undefined)
})
test('migration keeps draft and published snapshots separate with service-only privileges and revision locking', () => {
  const sql = readFileSync('supabase/migrations/202611090001_website_content.sql', 'utf8')
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /p_action IN \('unpublish','archive'\) THEN live := NULL/)
  assert.match(sql, /REVOKE ALL ON public.website_content/)
  assert.match(sql, /cloudinary_asset_id text NOT NULL UNIQUE/)
  assert.ok(!sql.includes('storage.buckets'))
  assert.match(sql, /r.key IN \('owner','admin'\)/)
})

test('published feed is consumed by the website and stays empty after unpublish', async () => {
  // Execute both repositories' real feed code with synthetic database rows only.
  // This does not exercise the SQL command RPC or a deployed HTTP connection.
  const { pathToFileURL } = require('node:url')
  const path = require('node:path')
  const website = path.resolve(process.env.HEADLINER_REVIEW_ROOT || '../headliner-app')
  const { loadWebsiteContent } = await import(pathToFileURL(path.join(website, 'src/lib/websiteContent.js')).href)
  const token = 'synthetic-reader-token-'.repeat(3)
  const h = createHarness()
  const configure = rows => h.setScenario({
    env: { WEBSITE_CONTENT_READ_TOKEN: token, WEBSITE_CONTENT_TENANT_ID: HEAD },
    fixtures: { website_content: rows },
  })
  configure([{ id: ID, tenant_id: HEAD, slug: 'retained-story-url', published: { ...base, summary: 'Published summary' }, published_at: '2026-11-10T12:00:00Z' }])
  const route = h.load('app/api/website-content/public/route.ts')
  const url = 'https://synthetic.invalid/api/website-content/public'
  assert.equal((await route.GET(new Request(url))).status, 401)
  const options = {
    env: { WEBSITE_CONTENT_API_URL: url, WEBSITE_CONTENT_READ_TOKEN: token },
    fetcher: (target, init) => route.GET(new Request(target, init)),
  }
  const live = await loadWebsiteContent(options)
  assert.equal(live.publications[0].slug, 'retained-story-url')
  assert.equal(live.publications[0].body[0].text, 'A story.')
  assert.ok(!JSON.stringify(live).includes(token))
  // Only the private draft remains after the live snapshot is removed.
  configure([])
  const removed = await loadWebsiteContent(options)
  assert.deepEqual(removed.publications, [])
  assert.deepEqual(removed.posters, [])
})