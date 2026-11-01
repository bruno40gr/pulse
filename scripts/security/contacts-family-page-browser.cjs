/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic page fixtures; never sends messages. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.CONTACTS_FAMILY_REVIEW_URL || 'http://127.0.0.1:3218/contacts-review'
const contact = (id, first, last, patch = {}) => ({
  id, first_name: first, last_name: last, client_status: 'active', custom_fields: {},
  phone: null, email: null, opted_out: false, last_attended: null, notes: null,
  family_name: null, account_holder_name: null, account_holder_phone: null,
  account_holder_email: null, ...patch,
})
const rows = [
  contact('solo', 'Avery', 'Adams'),
  contact('emma', 'Emma', 'Smith', { account_id: 'family', account_holder_name: 'Jane Smith' }),
  contact('noah', 'Noah', 'Smith', { account_id: 'family', account_holder_name: 'Jane Smith', client_status: 'inactive' }),
]
;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], requests = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.addInitScript(() => {
        localStorage.setItem('pulse_contact_insights_emma', '[]')
        localStorage.setItem('pulse_contact_insights_time_emma', new Date().toISOString())
      })
      await page.route('**/api/**', route => {
        const request = route.request(), path = new URL(request.url()).pathname
        requests.push(path)
        // The dashboard shell reconciles conversations independently of list interactions.
        // Intercept that existing background action; never let it reach a provider.
        if (request.method() === 'POST' && path === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
        if (request.method() !== 'GET') { writes.push(path); return route.abort() }
        if (path === '/api/account/me') return route.fulfill({ json: { tenantId: new URL(request.url()).searchParams.get('tenant'), membershipId: 'contacts-table-review' } })
        return route.fulfill({ json: path === '/api/contacts' ? rows : path === '/api/tenant-fields' ? [] : {} })
      })
      await page.goto(base)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      const box = name => table.getByRole('checkbox', { name: `Select ${name}`, exact: true })
      await box('Jane Smith').waitFor()
      assert.equal(await box('Emma Smith').count(), 0)
      assert.equal(await box('Noah Smith').count(), 0)
      assert.equal(await table.getByRole('button', { name: /Expand|Collapse/ }).count(), 0)
      assert.equal(await table.getByText('Emma Smith', { exact: true }).count(), 1)
      const trigger = page.getByRole('button', { name: 'Columns & spacing', exact: true })
      const picker = page.getByRole('group', { name: 'Table display options' })
      const initial = requests.filter(path => path === '/api/contacts').length
      await trigger.click()
      const email = picker.getByRole('checkbox', { name: 'Email', exact: true })
      await email.uncheck()
      assert.equal(await table.getByRole('columnheader', { name: 'Email', exact: true }).count(), 0)
      await picker.getByRole('combobox', { name: 'Row spacing' }).selectOption('compact')
      await picker.press('Escape')
      assert.ok(await trigger.evaluate(el => el === document.activeElement))
      await page.reload()
      await box('Jane Smith').waitFor()
      assert.equal(await table.getByRole('columnheader', { name: 'Email', exact: true }).count(), 0)
      await trigger.click()
      assert.equal(await picker.getByRole('combobox', { name: 'Row spacing' }).inputValue(), 'compact')
      await picker.getByRole('combobox', { name: 'Row spacing' }).selectOption('comfortable')
      await email.check()
      await picker.press('Escape')
      await box('Avery Adams').check()
      await box('Jane Smith').click({ modifiers: ['Shift'] })
      assert.equal(await page.getByRole('button', { name: 'Edit Contacts (3)', exact: true }).count() > 0, true)
      await box('Jane Smith').uncheck()
      assert.equal(await box('Avery Adams').isChecked(), true)
      assert.equal(await page.getByRole('button', { name: 'Edit Contacts (1)', exact: true }).count() > 0, true)
      await page.getByRole('button', { name: 'Filters', exact: true }).click()
      await page.getByRole('combobox').filter({ has: page.locator('option[value="active"]') }).selectOption('active')
      await page.getByRole('button', { name: 'Apply', exact: true }).click()
      assert.equal(await table.getByText('Noah Smith', { exact: true }).count(), 0)
      await box('Jane Smith').check()
      await page.getByRole('button', { name: 'Clear', exact: true }).click()
      assert.equal(await box('Jane Smith').isChecked(), false, 'Previously unselected hidden sibling was not selected')
      assert.equal(requests.filter(path => path === '/api/contacts').length, initial + 1, 'Only explicit reload refetches list')
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await table.getByRole('button', { name: 'Jane Smith', exact: true }).click()
      await page.getByRole('heading', { name: 'Jane Smith', exact: true }).waitFor()
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `/tmp/pulse-contacts-family-page-${width}.png`, fullPage: true })
      console.log(`PASS ${width}px: shared display controls/persistence, parent-only selection, filtered hidden sibling safeguard, holder account opening, no writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })