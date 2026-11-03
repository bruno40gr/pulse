/* eslint-disable @typescript-eslint/no-require-imports -- Local intercepted browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const review = require('./fixtures/contact-list-review.cjs')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) for (const linked of [true, false]) {
      // Flags must not control checkbox placement. The adult student is not a holder.
      const rows = review.filter(row => ['mock-sam', 'mock-jamie', 'mock-ethan', 'mock-sophie'].includes(row.id))
        .filter(row => linked || !['mock-sam', 'mock-jamie'].includes(row.id))
        .map(row => ({ ...row, is_minor: false, message_routing: 'student',
          account_holder_person_id: linked ? row.account_holder_person_id : null,
          account_holders: linked ? row.account_holders : row.account_holders.map(holder => ({ ...holder, person_id: undefined })),
        }))
      const page = await browser.newPage({ viewport: { width, height: 950 } })
      const requests = [], errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/communications/recipients') {
          requests.push(route.request().postDataJSON())
          return route.fulfill({ json: { selectedCount: requests.at(-1).contactIds.length,
            recipients: [], excluded: [], version: 'review' } })
        }
        if (path === '/api/contacts/check-sensitive') return route.fulfill({ json: { flagged: [], opted_out: [] } })
        if (path === '/api/communications/senders') return route.fulfill({ json: { senders: [] } })
        if (path === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
        if (route.request().method() !== 'GET') throw new Error(`Unexpected write: ${path}`)
        return route.fulfill({ json: path === '/api/contacts' ? rows : path === '/api/tenant-fields' ? [] : {} })
      })
      await page.goto(process.env.CONTACTS_REVIEW_URL || 'http://127.0.0.1:3218/dashboard/contacts')
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      await table.getByRole('button', { name: 'Ethan Kim', exact: true }).waitFor()
      // This suite exercises all-role rendering; the default active-student filter has its own suite.
      await page.getByRole('button', { name: 'Filters', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Clear filters', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Submit search', exact: true }).click()

      const labels = await table.getByRole('checkbox').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')))
      assert.deepEqual(labels, linked
        ? ['Select all contacts', 'Select Sam Kim', 'Select Jamie Kim']
        : ['Select all contacts', 'Select Sam Kim'])
      const sam = table.getByRole('checkbox', { name: 'Select Sam Kim', exact: true })
      await sam.focus()
      await page.keyboard.press('Space')
      assert.equal(await sam.isChecked(), true)
      if (linked) {
        const jamie = table.getByRole('checkbox', { name: 'Select Jamie Kim', exact: true })
        await jamie.uncheck()
        assert.equal(await sam.isChecked(), true)
        await jamie.check()
      }
      await page.getByRole('button', { name: 'Clear selection', exact: true }).click()
      await table.getByRole('checkbox', { name: 'Select all contacts', exact: true }).check()
      assert.equal(await sam.isChecked(), true)
      for (const name of ['Ethan Kim', 'Sophie Kim']) {
        const row = table.getByRole('button', { name, exact: true }).locator('xpath=ancestor::*[@role="row"][1]')
        assert.equal(await row.getByRole('checkbox').count(), 0, `${name}: no detail checkbox even after select-all`)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.getByRole('button', { name: 'Email', exact: true }).click()
      await page.waitForTimeout(500)
      assert.ok(requests.length > 0, 'Existing composer resolves the header selection directly')
      assert.deepEqual([...requests[0].contactIds].sort(), linked
        ? ['mock-jamie', 'mock-sam'] : ['mock-ethan', 'mock-sophie'])
      assert.deepEqual(errors, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      console.log(`PASS ${width}px: ${linked ? 'linked holders' : 'account summary'}, header keyboard selection, no child checkboxes, direct composer`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })