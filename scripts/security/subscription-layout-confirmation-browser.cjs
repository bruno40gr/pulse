/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional prototype regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STUDENT_REVIEW_URL || 'http://127.0.0.1:3197/students'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local lab required')
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = []
      page.setDefaultTimeout(10000)
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== new URL(base).origin) return route.abort()
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: url.pathname === '/api/account/identity' ? { fullName: 'Preview staff', firstName: 'Preview', isDemo: true } : { count: 0, notifications: [], unread_count: 0, show: false } })
        return route.continue()
      })
      await page.goto(`${base}?prototype=v3&view=quick&account=preview:kim&section=profile`)
      await page.getByRole('heading', { name: 'Account Balance', exact: true }).waitFor()
      for (const name of ['Sophie Kim', 'Ethan Kim']) {
        const dependent = page.getByRole('region', { name: `${name} dependent`, exact: true })
        const heading = dependent.getByRole('heading', { name, exact: true })
        const add = dependent.getByRole('button', { name: 'Add subscription', exact: true })
        assert.equal(await add.count(), 1)
        const h = await heading.boundingBox(), a = await add.boundingBox()
        assert.ok(Math.abs(h.y - a.y) < 20, 'Add subscription shares the student-name header')
        await add.click()
        await page.getByRole('heading', { name: 'Add subscription', exact: true }).waitFor()
        const student = page.getByLabel('Student', { exact: true })
        assert.equal(await student.inputValue(), name === 'Sophie Kim' ? 'preview:sophie' : 'preview:ethan')
        await page.getByRole('button', { name: `Back to ${name}`, exact: true }).click()
      }
      await page.screenshot({ path: `/tmp/odeon-subscription-account-${width}.png`, fullPage: true })
      await page.goto(`${base}?prototype=v3&view=quick&account=preview:kim&student=preview:sophie&section=profile`)
      const subscriptions = page.getByRole('region', { name: 'Sophie Kim subscriptions', exact: true })
      await subscriptions.getByRole('heading', { name: 'Subscriptions', exact: true }).waitFor()
      for (const program of ['Piano', 'Voice']) await subscriptions.getByRole('heading', { name: `${program} • 30 min`, exact: true }).waitFor()
      assert.equal(await subscriptions.getByRole('button', { name: 'Add subscription', exact: true }).count(), 1)
      await page.screenshot({ path: `/tmp/odeon-subscription-child-${width}.png`, fullPage: true })
      await page.goto(`${base}?prototype=v3&view=quick&account=preview:kim&section=billing`)
      await page.getByRole('button', { name: 'View invoice DEMO-1004', exact: true }).click()
      await page.getByRole('button', { name: 'Pay $200', exact: true }).click()
      const payment = page.getByRole('dialog', { name: 'Pay', exact: true })
      const pay = payment.getByRole('button', { name: 'Pay', exact: true })
      await pay.click()
      assert.equal(await page.getByRole('status').filter({ hasText: 'Payment recorded' }).count(), 0, 'Early release does not confirm payment')
      await pay.click({ delay: 1700 })
      await page.getByRole('status').filter({ hasText: 'Payment recorded. Invoice paid.' }).waitFor()
      await page.getByRole('dialog', { name: 'Confirmation', exact: true }).getByRole('button', { name: 'Done', exact: true }).click()
      assert.equal(await page.getByRole('status').filter({ hasText: 'Payment recorded' }).count(), 0)
      assert.deepEqual(errors, [])
      console.log(`PASS subscription headers, student targeting, child grouping and payment confirmation ${width}px`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })