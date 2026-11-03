/* eslint-disable @typescript-eslint/no-require-imports -- Intercepted synthetic recipients; no sends. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const contacts = require('./fixtures/contact-list-review.cjs')
const recipients = [
  { name: 'Michelle Example', destination: '+13049191553' },
  { name: 'Alexandra Example', destination: '+19162571078' },
  { name: 'Shauna Example', destination: '+19163500877' },
]
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/communications/recipients') return route.fulfill({ json: { selectedCount: 3, recipients, excluded: [], version: 'fixture' } })
        if (path === '/api/contacts/check-sensitive') return route.fulfill({ json: { flagged: [], opted_out: [] } })
        if (path === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
        if (route.request().method() !== 'GET') throw new Error(`Unexpected write ${path}`)
        return route.fulfill({ json: path === '/api/contacts' ? contacts : path === '/api/tenant-fields' ? [] : path === '/api/communications/senders' ? { senders: [] } : {} })
      })
      await page.goto('http://127.0.0.1:3218/dashboard/contacts')
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      await table.getByRole('button', { name: 'Ethan Kim', exact: true }).waitFor()
      await table.getByRole('checkbox').nth(1).check()
      await page.getByRole('region', { name: 'Table results and actions' }).getByRole('button', { name: 'Text', exact: true }).click()
      const list = page.getByRole('region', { name: 'Verified SMS recipients' })
      await list.getByText('(304) 919-1553', { exact: true }).waitFor()
      assert.equal(await list.getByRole('listitem').count(), 3)
      assert.equal(await list.locator('strong').first().evaluate(node => getComputedStyle(node).fontWeight), '700')
      assert.doesNotMatch(await list.innerText(), /—/)
      for (const number of ['(916) 257-1078', '(916) 350-0877']) assert.equal(await list.getByText(number, { exact: true }).count(), 1)
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `/private/tmp/sms-recipient-format-${width}.png` })
      console.log(`PASS ${width}px: formatted SMS destinations, bold names, no em dashes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })