/* eslint-disable @typescript-eslint/no-require-imports -- Local UI lab with synthetic, intercepted APIs only. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.LEAD_ADD_REVIEW_URL || 'http://127.0.0.1:3197'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('This synthetic journey must run against a local UI lab.')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, serviceWorkers: 'block' })
      const page = await context.newPage()
      page.setDefaultTimeout(10000)
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', route => {
        const request = route.request(), url = new URL(request.url())
        if (url.origin !== new URL(base).origin) return route.abort()
        if (url.pathname.startsWith('/api/')) {
          if (url.pathname === '/api/intake' && request.method() === 'POST') {
            writes.push(request.postDataJSON())
            return route.fulfill({ json: { queued: true, receipt_id: 'synthetic-receipt' } })
          }
          assert.equal(request.method(), 'GET', `Unexpected write: ${url.pathname}`)
          return route.fulfill({ json: url.pathname === '/api/leads' ? { leads: [], counts: {} } : { connected: false, configured: false } })
        }
        return route.continue()
      })
      await page.goto(base)
      await page.getByRole('button', { name: '+ Add Lead', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Add lead', exact: true })
      const save = dialog.getByRole('button', { name: 'Create lead', exact: true })
      const name = dialog.getByLabel('Contact name', { exact: true })
      const email = dialog.getByLabel('Email', { exact: true })
      assert.equal(await dialog.locator('[aria-invalid="true"]').count(), 0)
      await name.focus()
      await email.focus()
      assert.equal(await dialog.getByRole('alert').count(), 0, 'Focus/blur must not trigger errors')
      assert.equal(await save.isEnabled(), true)
      await save.click()
      const summary = dialog.getByRole('alert', { name: 'Could not create lead', exact: true })
      await summary.waitFor()
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Could not create lead')
      assert.equal(await name.getAttribute('aria-invalid'), 'true')
      assert.equal(await email.getAttribute('aria-invalid'), 'true')
      assert.equal(writes.length, 0)
      await name.fill('Synthetic Contact')
      await email.fill('invalid')
      await save.click()
      assert.equal(writes.length, 0)
      await email.fill('synthetic@example.invalid')
      await summary.waitFor({ state: 'detached' })
      assert.equal(await dialog.locator('[aria-invalid="true"]').count(), 0)

      // Exercise independent learner fields and the narrow container grid.
      await dialog.getByRole('checkbox', { name: 'Classes are for myself', exact: true }).uncheck()
      const birthday = dialog.getByLabel('Student 1 birthday', { exact: true })
      await birthday.fill('2999-01-01')
      await save.click()
      await summary.waitFor()
      assert.equal(await birthday.getAttribute('aria-invalid'), 'true')
      assert.equal(writes.length, 0)
      await birthday.fill('2010-01-01')
      await summary.waitFor({ state: 'detached' })
      const student = dialog.locator('fieldset').first()
      assert.equal(await student.evaluate(el => getComputedStyle(el).borderTopWidth), '0px')
      for (const grid of await dialog.locator('[data-columns]').all()) {
        const layout = await grid.evaluate(el => ({ columns: getComputedStyle(el).gridTemplateColumns.split(' ').length, width: el.getBoundingClientRect().width }))
        assert.ok(layout.columns <= 2)
        if (layout.width < 540) assert.equal(layout.columns, 1, 'Narrow containers retain one field per row')
      }
      await page.screenshot({ path: `/tmp/odeon-integration-add-lead-${width}.png`, fullPage: true })
      assert.equal(await dialog.evaluate(el => el.scrollWidth > el.clientWidth), false, 'Drawer must not overflow horizontally')
      await save.click()
      await dialog.getByText(/Inquiry safely queued/).waitFor()
      assert.equal(writes.length, 1)
      assert.equal(writes[0].full_name, 'Synthetic Contact')
      assert.equal(writes[0].email, 'synthetic@example.invalid')
      assert.equal(writes[0].phone, null)
      assert.equal(writes[0].source_system, 'pulse-manual')
      assert.equal(await save.isDisabled(), true, 'Queued receipt prevents duplicate submission')
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: '+ Add Lead', exact: true }).click()
      assert.equal(await name.inputValue(), '')
      assert.equal(await email.inputValue(), '')
      assert.equal(await dialog.getByRole('alert').count(), 0)
      assert.equal(await dialog.locator('[aria-invalid="true"]').count(), 0)
      assert.equal(await save.isEnabled(), true)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: Save-only validation, summary focus, no invalid writes, optional phone, field density, queue protection and fresh-form reset`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })