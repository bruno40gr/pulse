/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic fixtures; no outgoing writes. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FAMILY_MEMBERS_REVIEW_URL || 'http://127.0.0.1:3271/dashboard/contacts'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixtures only')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      const tenant = '00000000-0000-0000-0000-000000000001'
      const holder = { person_id: 'holder', account_id: 'family', name: 'Jane Smith', is_primary: true }
      const second = { person_id: 'second', account_id: 'family', name: 'Alex Smith' }
      const row = (id, first_name, patch) => ({ id, tenant_id: tenant, first_name, last_name: 'Smith', phone: null, email: null, client_status: 'active', custom_fields: {}, notes_history: [], student_notes_history: [], ...patch })
      const roster = [row('child', 'Emma', { is_student: true, student_id: 's1', account_id: 'family', account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', account_holders: [holder, second] }),
        row('sibling', 'Noah', { is_student: true, student_id: 's2', account_id: 'family', account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', account_holders: [holder, second] }),
        row('holder', 'Jane', { is_student: false }), row('second', 'Alex', { is_student: true, student_id: 's3', account_id: 'family', account_holder_person_id: 'holder', account_holders: [holder, second] })]
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url())
        if (route.request().method() !== 'GET') writes.push(url.pathname)
        if (url.pathname === '/api/contacts') return route.fulfill({ json: roster, headers: { 'X-Contacts-Can-Edit': 'true' } })
        return route.fulfill({ json: [] })
      })
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 })
      const dialog = page.getByRole('dialog')
      await page.getByRole('table', { name: 'Contacts' }).getByRole('button', { name: 'Jane Smith', exact: true }).click()
      const family = dialog.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Family members', exact: true }) })
      await dialog.getByRole('heading', { name: 'Family members', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('link', { name: 'Jane Smith', exact: true }).count(), 0)
      assert.equal(await dialog.getByRole('link', { name: 'Alex Smith', exact: true }).count(), 1)
      assert.match(await dialog.getByRole('link', { name: 'Alex Smith', exact: true }).locator('..').innerText(), /Account holder · Student/)
      assert.equal(await dialog.getByText('Dependents', { exact: true }).count(), 0)
      assert.equal(await dialog.getByRole('heading', { name: 'Account holders', exact: true }).count(), 0)
      assert.ok(await family.count())
      await dialog.getByRole('link', { name: 'Emma Smith', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Emma Smith', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('link', { name: 'Emma Smith', exact: true }).count(), 0)
      await dialog.getByRole('link', { name: 'Noah Smith', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Noah Smith', exact: true }).waitFor()
      await dialog.getByRole('button', { name: 'Back to contact', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Emma Smith', exact: true }).waitFor()
      await dialog.getByRole('link', { name: 'Jane Smith', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Jane Smith', exact: true }).waitFor()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path: `/tmp/profile-family-members-${width}.png` })
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${width}px: holder/student family links, self exclusion, deduplicated dual roles, sibling shortcut, Back, no sends`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })