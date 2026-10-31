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
        if (request.method() !== 'GET') { writes.push(path); return route.abort() }
        return route.fulfill({ json: path === '/api/contacts' ? rows : path === '/api/tenant-fields' ? [] : {} })
      })
      await page.goto(base)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      const box = name => table.getByRole('checkbox', { name: `Select ${name}`, exact: true })
      await box('Noah Smith').waitFor()
      const initial = requests.length
      await box('Avery Adams').check()
      await box('Jane Smith').click({ modifiers: ['Shift'] })
      assert.equal(await box('Emma Smith').isChecked(), true)
      assert.equal(await box('Noah Smith').isChecked(), true)
      await box('Jane Smith').click({ modifiers: ['Shift'] })
      assert.equal(await box('Avery Adams').isChecked(), true, 'Holder deselection must not affect an earlier range anchor')
      assert.equal(await box('Emma Smith').isChecked(), false)
      assert.equal(await box('Noah Smith').isChecked(), false)
      await table.getByRole('button', { name: 'Collapse Jane Smith' }).press('Enter')
      assert.equal(await box('Emma Smith').count(), 0)
      await table.getByRole('button', { name: 'Expand Jane Smith' }).press('Space')
      await box('Noah Smith').check()
      await page.getByRole('button', { name: 'Filters', exact: true }).click()
      await page.getByRole('combobox').filter({ has: page.locator('option[value="active"]') }).selectOption('active')
      await page.getByRole('button', { name: 'Apply', exact: true }).click()
      assert.equal(await box('Noah Smith').count(), 0)
      await box('Jane Smith').check()
      await box('Jane Smith').uncheck()
      await page.getByRole('button', { name: 'Clear', exact: true }).click()
      assert.equal(await box('Noah Smith').isChecked(), true, 'Filtered-out sibling keeps its prior selection')
      assert.equal(await box('Emma Smith').isChecked(), false)
      assert.equal(requests.length, initial, 'Selection, filtering and disclosure add no requests')
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await table.getByRole('button', { name: 'Emma Smith', exact: true }).click()
      await page.getByRole('heading', { name: 'Emma Smith', exact: true }).waitFor()
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `/tmp/pulse-contacts-family-page-${width}.png`, fullPage: true })
      console.log(`PASS ${width}px: real Contacts page, Shift holder selection, filtered sibling preservation, keyboard disclosure, profile handoff, no extra list requests or writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })