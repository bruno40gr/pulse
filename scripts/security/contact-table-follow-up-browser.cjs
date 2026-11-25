/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only fixtures; all APIs intercepted. */
const assert = require('node:assert/strict')
const { createHmac } = require('node:crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FAMILY_REVIEW_URL || 'http://127.0.0.1:3271'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Loopback only')
const tenant = '00000000-0000-0000-0000-000000000001'
const payload = Buffer.from(JSON.stringify({ actor: { personId: 'fixture', displayName: 'Fixture', access: { kind: 'demo', tenantId: tenant } }, expiresAt: Date.now() + 3600000 })).toString('base64url')
const cookie = `${payload}.${createHmac('sha256', process.env.PULSE_SESSION_SECRET || 'pulse-headliner-session-2026').update(payload).digest('base64url')}`
const rows = [
  { id: 'amy', first_name: 'Amy', follow_up_at: '2026-12-03T12:00:00Z', follow_up_note: 'Alpha reminder', relationship_badges: ['Disenrolled'] },
  { id: 'ben', first_name: 'Ben', follow_up_at: '2026-12-01T12:00:00Z', follow_up_note: 'Zulu reminder', relationship_badges: ['Enrolled'] },
  { id: 'cam', first_name: 'Cam', follow_up_at: null, follow_up_note: null, relationship_badges: ['À la carte', 'Service client'] },
].map(row => ({ ...row, tenant_id: tenant, last_name: 'Example', is_student: true, student_id: `student-${row.id}`, custom_fields: {}, client_status: 'active' }))
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(20000)
      await page.context().addCookies([{ name: 'pulse_access', value: cookie, url: base }])
      const errors = [], unexpected = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const request = route.request(), path = new URL(request.url()).pathname
        if (request.method() !== 'GET') { unexpected.push(`${request.method()} ${path}`); return route.abort() }
        if (path === '/api/contacts') return route.fulfill({ json: rows, headers: { 'X-Contacts-Can-Edit': 'true' } })
        if (path === '/api/account/me') return route.fulfill({ json: { tenantId: tenant, membershipId: 'fixture' } })
        if (path === '/api/tenant-fields') return route.fulfill({ json: [] })
        if (path === '/api/tenant/sync-status') return route.fulfill({ json: { last_synced_at: null } })
        unexpected.push(path); return route.fulfill({ status: 500, json: {} })
      })
      await page.goto(`${base}/dashboard/contacts`)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      await table.getByRole('button', { name: 'Amy Example', exact: true }).waitFor()
      assert.equal(await table.getByRole('columnheader', { name: 'Status', exact: true }).count(), 0)
      for (const [name, badge] of [['Amy', 'Disenrolled'], ['Ben', 'Enrolled'], ['Cam', 'À la carte']]) {
        const row = table.getByRole('row').filter({ has: page.getByRole('button', { name: `${name} Example`, exact: true }) })
        const cell = row.getByRole('cell').filter({ has: page.getByRole('button', { name: `${name} Example`, exact: true }) })
        await cell.getByText(badge, { exact: true }).waitFor()
      }
      const names = () => table.getByRole('button', { name: /^(Amy|Ben|Cam) Example$/ }).allTextContents()
      const assertOrder = async order => {
        await page.waitForFunction(expected => {
          const table = document.querySelector('[role="table"][aria-label="Contacts"]')
          const names = [...(table?.querySelectorAll('button') || [])].map(button => button.textContent).filter(text => /^(Amy|Ben|Cam) Example$/.test(text))
          return JSON.stringify(names) === JSON.stringify(expected)
        }, order)
        assert.deepEqual(await names(), order)
      }
      await table.getByRole('button', { name: 'Follow-up date', exact: true }).click()
      await assertOrder(['Ben Example', 'Amy Example', 'Cam Example'])
      await table.getByRole('button', { name: 'Follow-up date, sorted ascending', exact: true }).click()
      await assertOrder(['Amy Example', 'Ben Example', 'Cam Example'])
      await table.getByRole('button', { name: 'Follow-up note', exact: true }).click()
      await assertOrder(['Amy Example', 'Ben Example', 'Cam Example'])
      await table.getByRole('button', { name: 'Follow-up note, sorted ascending', exact: true }).click()
      await assertOrder(['Ben Example', 'Amy Example', 'Cam Example'])
      await page.reload()
      await table.getByRole('button', { name: 'Follow-up note, sorted descending', exact: true }).waitFor()
      await assertOrder(['Ben Example', 'Amy Example', 'Cam Example'])
      assert.deepEqual(errors, []); assert.deepEqual(unexpected, [])
      console.log(`PASS ${width}px: separate date/note sorts both directions, blanks last, persisted sort, own badges in name cells, no Status column or writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })