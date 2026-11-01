/* eslint-disable @typescript-eslint/no-require-imports -- Fictional preview, intercepted APIs; no providers. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.SMS_SAFETY_REVIEW_URL || 'http://127.0.0.1:3218/sms-safety'
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], sends = [], unexpected = []
      page.on('pageerror', error => errors.push(error.message))
      let blocked = false, changed = false
      await page.route('**/api/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname
        if (path === '/api/communications/recipients') {
          assert.equal(request.postDataJSON().channel, 'sms')
          return route.fulfill({ json: { selectedCount: 1, recipients: blocked ? [] : [{ destination: '+12025550101', name: 'Morgan Recipient', contactIds: ['00000000-0000-0000-0000-000000000101'] }], excluded: blocked ? [{ id: 'one', name: 'Student Subject', reason: 'No account-manager phone number on file' }] : [], version: 'reviewed' } })
        }
        if (path === '/api/campaigns') return route.fulfill({ json: { id: 'fictional' } })
        if (path === '/api/campaigns/fictional/send') {
          sends.push(request.postDataJSON())
          return route.fulfill({ status: changed ? 409 : 200, json: changed ? { error: 'Recipient details changed. Reopen the composer.' } : { ok: true, sent: 1 } })
        }
        if (path === '/api/contacts/check-sensitive') return route.fulfill({ json: { flagged: [], opted_out: [] } })
        if (request.method() !== 'GET') unexpected.push(path)
        return route.fulfill({ json: ['/api/contacts', '/api/staff'].includes(path) ? [] : {} })
      })
      await page.goto(base)
      const region = page.getByRole('region', { name: 'Verified SMS recipients' })
      await region.getByText('Morgan Recipient', { exact: true }).waitFor()
      await region.getByText('+12025550101', { exact: true }).waitFor()
      await page.getByPlaceholder('Write your message... Use {first_name} to personalize.').fill('Schedule update')
      changed = true
      await page.getByRole('button', { name: 'Send message', exact: true }).click()
      await page.getByText('Recipient details changed. Reopen the composer.', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'Send message', exact: true }).waitFor()
      assert.equal(sends[0].recipientVersion, 'reviewed')
      await page.screenshot({ path: `/private/tmp/pulse-sms-safety-reviewed-${width}.png` })
      blocked = true
      await page.reload()
      await page.getByText('Excluded from sending', { exact: true }).waitFor()
      await page.getByRole('button', { name: 'See contacts', exact: true }).click()
      await page.getByText('Student Subject — No account-manager phone number on file', { exact: true }).waitFor()
      await page.getByPlaceholder('Write your message... Use {first_name} to personalize.').fill('Must not send')
      assert.equal(await page.getByRole('button', { name: 'Send message', exact: true }).isDisabled(), true)
      assert.equal(sends.length, 1)
      assert.deepEqual(unexpected, [])
      assert.deepEqual(errors, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.screenshot({ path: `/private/tmp/pulse-sms-safety-blocked-${width}.png` })
      console.log(`PASS ${width}px: actual recipient/destination, reviewed version, stale response, missing destination blocked; intercepted writes only`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })