/* eslint-disable @typescript-eslint/no-require-imports -- Local synthetic fixtures; no outgoing writes. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FAMILY_MEMBERS_REVIEW_URL || 'http://127.0.0.1:3271/dashboard/contacts'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local fixtures only')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1280, 1440, 1920, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      const tenant = '00000000-0000-0000-0000-000000000001'
      const holder = { person_id: 'holder', account_id: 'family', name: 'Jane Smith', is_primary: true }
      const legacy = { name: 'Alexandra Lausten', account_id: 'alexandra', phone: '9162571078', email: 'alexandra@example.invalid' }
      const second = { person_id: 'second', account_id: 'family', name: 'Alex Smith' }
      const row = (id, first_name, patch) => ({ id, tenant_id: tenant, first_name, last_name: 'Smith', phone: '9167428265', email: 'averylongemailaddressforlayoutverification@example.invalid', client_status: 'active', custom_fields: {}, notes_history: [], student_notes_history: [], ...patch })
      const roster = [row('child', 'Emma', { is_student: true, student_id: 's1', account_id: 'family', account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', family_name: 'Jane Smith', family_account_id: 'family', family_linked_account_ids: [], linked_account_ids: [], account_holders: [holder, second, legacy] }),
        row('sibling', 'Noah', { is_student: true, student_id: 's2', account_id: 'family', account_holder_person_id: 'holder', account_holder_name: 'Jane Smith', family_name: 'Jane Smith', family_account_id: 'family', family_linked_account_ids: [], linked_account_ids: [], account_holders: [holder, second, legacy] }),
        row('holder', 'Jane', { is_student: false }), row('second', 'Alex', { is_student: true, student_id: 's3', account_id: 'family', account_holder_person_id: 'holder', family_name: 'Jane Smith', family_account_id: 'family', family_linked_account_ids: [], linked_account_ids: [], account_holders: [holder, second, legacy] })]
      await page.route('**/api/**', async route => {
        const url = new URL(route.request().url())
        if (route.request().method() !== 'GET') writes.push(url.pathname)
        if (url.pathname === '/api/contacts') return route.fulfill({ json: roster, headers: { 'X-Contacts-Can-Edit': 'true' } })
        return route.fulfill({ json: [] })
      })
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 45000 })
      const dialog = page.getByRole('dialog')
      await page.getByRole('table', { name: 'Contacts' }).getByRole('button', { name: 'Jane Smith', exact: true }).first().click()
      const family = dialog.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Family members', exact: true }) })
      await dialog.getByRole('heading', { name: 'Family members', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('link', { name: 'Jane Smith', exact: true }).count(), 0)
      assert.equal(await dialog.getByRole('link', { name: 'Alex Smith', exact: true }).count(), 1)
      assert.match(await dialog.getByRole('link', { name: 'Alex Smith', exact: true }).locator('../..').innerText(), /Account holder · Student/)
      assert.equal(await dialog.getByText('Dependents', { exact: true }).count(), 0)
      assert.equal(await dialog.getByRole('heading', { name: 'Account holders', exact: true }).count(), 0)
      assert.ok(await family.count())
      const bounds = await dialog.boundingBox()
      assert.ok(Math.abs(bounds.width - (width > 760 ? width * 0.65 : width)) < 2)
      await dialog.getByRole('button', { name: 'Impersonate', exact: true }).getByText('Impersonate', { exact: true }).waitFor()
      const nameLink = dialog.getByRole('link', { name: 'Emma Smith', exact: true })
      assert.equal(await nameLink.locator('svg').count(), 1)
      if (width > 760) {
        const actionBoxes = await Promise.all(['Call', 'Send SMS', 'Send email', 'Edit Contact', 'Impersonate'].map(name => dialog.getByRole('button', { name, exact: true }).boundingBox()))
        assert.ok(actionBoxes.every(box => Math.abs(box.y - actionBoxes[0].y) < 3), 'desktop toolbar stays on one row')
        assert.ok(actionBoxes.every(box => box.x >= bounds.x && box.x + box.width <= bounds.x + bounds.width), 'actions stay within panel')
        const email = dialog.getByRole('button', { name: 'Send email', exact: true }).locator('span')
        assert.equal(await email.evaluate(node => getComputedStyle(node).textOverflow), 'ellipsis')
      }
      await dialog.getByRole('link', { name: 'Emma Smith', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Emma Smith', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('link', { name: 'Emma Smith', exact: true }).count(), 0)
      await dialog.getByRole('link', { name: 'Noah Smith', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Noah Smith', exact: true }).waitFor()
      assert.equal(await dialog.getByRole('button', { name: 'Back to contact', exact: true }).count(), 0)
      assert.equal(await page.getByRole('dialog').count(), 1)
      await dialog.getByRole('link', { name: 'Emma Smith', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Emma Smith', exact: true }).waitFor()
      await dialog.getByRole('link', { name: 'Alexandra Lausten', exact: true }).click()
      await dialog.getByRole('heading', { name: 'Alexandra Lausten', exact: true }).waitFor()
      assert.equal(await page.getByRole('dialog').count(), 1)
      assert.equal(await dialog.getByRole('button', { name: 'Back to contact', exact: true }).count(), 0)
      assert.match(await dialog.getByRole('button', { name: 'Send email', exact: true }).innerText(), /alexandra@example.invalid/)
      assert.equal(await dialog.getByRole('link', { name: 'Alexandra Lausten', exact: true }).count(), 0)
      const robLink = dialog.getByRole('link', { name: 'Jane Smith', exact: true })
      await robLink.waitFor()
      const role = robLink.locator('../..').getByText('Account holder', { exact: true })
      const metadataLabel = dialog.getByText('Member since', { exact: true })
      const textStyle = node => { const css = getComputedStyle(node); return [css.fontSize, css.fontWeight, css.color] }
      assert.deepEqual(await role.evaluate(textStyle), await metadataLabel.evaluate(textStyle))
      const addSubscription = dialog.getByRole('button', { name: 'Add subscription', exact: true }).first()
      const addStudent = dialog.getByRole('button', { name: 'Add student', exact: true })
      assert.deepEqual(await addSubscription.evaluate(textStyle), await addStudent.evaluate(textStyle))
      await robLink.click()
      await dialog.getByRole('heading', { name: 'Jane Smith', exact: true }).waitFor()
      await dialog.getByRole('link', { name: 'Alexandra Lausten', exact: true }).waitFor()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      assert.ok(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'panel content is not clipped horizontally')
      await page.screenshot({ path: `/tmp/profile-family-members-${width}.png` })
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${width}px: holder/student family links, self exclusion, deduplicated dual roles, direct sibling/account-only holder navigation, 65% width, labeled Impersonate, single-row desktop toolbar, no sends`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })