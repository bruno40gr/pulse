/* eslint-disable @typescript-eslint/no-require-imports -- Local intercepted fixtures; no domain writes. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const contacts = require('./fixtures/contact-list-review.cjs')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } })
      const errors = []
      let identityCalls = 0
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/account/me') {
          identityCalls++
          await new Promise(resolve => setTimeout(resolve, 1800))
          return route.fulfill({ json: { membershipId: 'review-member', tenantId: new URL(route.request().url()).searchParams.get('tenant') } })
        }
        if (path === '/api/ai-filter') {
          await new Promise(resolve => setTimeout(resolve, 300))
          return route.fulfill({ json: { contact_ids: contacts.map(row => row.id), explanation: 'All contacts' } })
        }
        if (path === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
        if (route.request().method() !== 'GET') throw new Error(`Unexpected write: ${path}`)
        return route.fulfill({ json: path === '/api/contacts' ? contacts : path === '/api/tenant-fields' ? [] : {} })
      })
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      const preferences = page.getByRole('button', { name: 'Table Preferences', exact: true })
      const checkCompact = async () => {
        await preferences.click()
        assert.equal(await page.getByRole('combobox', { name: 'Row spacing' }).inputValue(), 'compact')
        await page.keyboard.press('Escape')
      }
      await page.goto('http://127.0.0.1:3218/dashboard/contacts')
      await table.getByRole('button', { name: 'Ethan Kim', exact: true }).waitFor()
      assert.equal(await page.getByRole('button', { name: /Add contact/i }).count(), 0)
      const title = await page.getByRole('heading', { name: 'Contacts', exact: true }).boundingBox()
      const enroll = await page.getByRole('link', { name: 'Enroll new student', exact: true }).boundingBox()
      if (width === 1440) {
        assert.ok(Math.abs(title.y - enroll.y) < 2, 'Actions top-aligned beside title')
        assert.ok(enroll.x > title.x + title.width)
      }
      await preferences.click()
      await page.getByRole('combobox', { name: 'Row spacing' }).selectOption('compact')
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith('pulse_contacts_table_v1:') && JSON.parse(localStorage.getItem(key)).density === 'compact'))
      for (const name of ['View students', 'View families']) {
        await page.getByRole('button', { name, exact: true }).click()
        await checkCompact()
      }
      const beforeSearchCalls = identityCalls
      await page.getByRole('textbox', { name: 'Search contacts' }).fill('all')
      await page.getByRole('button', { name: 'Search', exact: true }).click()
      await table.getByRole('button', { name: 'Ethan Kim', exact: true }).waitFor()
      await checkCompact()
      assert.equal(identityCalls, beforeSearchCalls, 'Search remount does not restart identity/preference hydration')
      await page.getByRole('button', { name: 'Filters', exact: true }).click()
      const drawer = page.getByRole('dialog')
      await drawer.getByRole('checkbox', { name: 'Show only active students & families', exact: true }).uncheck()
      await drawer.getByRole('button', { name: 'Submit search', exact: true }).click()
      await checkCompact()
      await table.getByRole('checkbox').nth(1).check()
      await checkCompact()
      await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
      await checkCompact()
      await page.reload()
      await page.waitForTimeout(2000)
      await checkCompact()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: compact survives view/search/remount/reload, saved early change, enrollment-only header`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })