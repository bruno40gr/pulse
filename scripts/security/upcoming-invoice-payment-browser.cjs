/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional billing regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STUDENT_REVIEW_URL || 'http://127.0.0.1:3197/students'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local lab required')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
      const page = await context.newPage()
      page.setDefaultTimeout(10000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== new URL(base).origin) return route.abort()
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: url.pathname === '/api/account/identity' ? { fullName: 'Preview staff', firstName: 'Preview', isDemo: true } : { count: 0, notifications: [], unread_count: 0, show: false } })
        return route.continue()
      })
      await page.goto(`${base}?prototype=v3&view=quick&account=preview%3Akim&section=billing`)
      const invoices = page.getByRole('region', { name: 'Invoices', exact: true })
      const upcoming = invoices.getByRole('button', { name: 'View invoice DEMO-1004', exact: true }).locator('..').locator('..')
      await upcoming.getByText(/Due.*Nov.*15/).waitFor()
      const entry = upcoming.getByRole('button', { name: 'Pay $200', exact: true })
      assert.equal(await entry.isEnabled(), true, 'An unpaid invoice is payable before its due date')
      assert.equal(await entry.locator('svg').count(), 1, 'Payment entry includes a navigation arrow')
      assert.equal(await entry.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Upcoming invoice payment stays neutral')
      await entry.click()
      const payment = page.getByRole('dialog', { name: 'Pay', exact: true })
      await payment.waitFor()
      await payment.getByRole('button', { name: 'Close', exact: true }).click()
      await upcoming.getByRole('button', { name: 'View invoice DEMO-1004', exact: true }).click()
      const document = page.getByRole('article', { name: 'Itemized invoice', exact: true })
      const documentPay = page.getByRole('button', { name: 'Pay $200', exact: true })
      await documentPay.click()
      const pay = payment.getByRole('button', { name: 'Pay', exact: true })
      await pay.click()
      assert.equal(await payment.isVisible(), true, 'Opening details and quick clicks never pay')
      await pay.click({ delay: 1700 })
      await payment.waitFor({ state: 'hidden' })
      await document.getByText('Paid', { exact: true }).first().waitFor()
      assert.equal(await documentPay.count(), 0, 'Settled invoices no longer offer payment')
      assert.deepEqual(errors, [])
      console.log(`PASS upcoming invoice card/document payment before due date ${width}px`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })