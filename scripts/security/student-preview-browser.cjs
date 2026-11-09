/* eslint-disable @typescript-eslint/no-require-imports -- Fictional isolated UI lab. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STUDENT_REVIEW_URL || 'http://127.0.0.1:3197/students'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local lab required')

// Contacts intentionally uses the shared flat table, not the retired treegrid.
// Detailed scheduling, billing and parent journeys have dedicated browser suites.
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 1100 }, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = [], apis = []
      page.setDefaultTimeout(15000)
      page.on('pageerror', error => errors.push(error.message))
      await context.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.hostname === 'res.cloudinary.com' && route.request().resourceType() === 'image') return route.continue()
        if (url.origin !== new URL(base).origin) return route.abort()
        if (url.pathname.startsWith('/api/')) {
          const shell = ['/api/account/identity', '/api/account/claim-reminder', '/api/notifications', '/api/leads', '/api/inbox', '/api/inbox/reconcile', '/api/tenant/sync-status']
          if (!shell.includes(url.pathname)) { apis.push(url.pathname); return route.abort() }
          return route.fulfill({ json: url.pathname === '/api/account/identity' ? { fullName: 'Preview staff', firstName: 'Preview', isDemo: true } : { count: 0, notifications: [], unread_count: 0, show: false } })
        }
        return route.continue()
      })
      await page.goto(`${base}?prototype=v1`)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      const search = page.getByRole('searchbox', { name: 'Search contacts', exact: true })
      await table.getByRole('button', { name: 'Open Kim family', exact: true }).waitFor()
      assert.equal(await page.getByRole('treegrid').count(), 0)
      await search.fill('Kim')
      assert.equal(await table.getByRole('button', { name: 'Open Alex Morgan', exact: true }).count(), 0)
      await table.getByRole('checkbox', { name: 'Select all contacts', exact: true }).check()
      for (const name of ['Sam Kim', 'Sophie Kim', 'Ethan Kim']) assert.equal(await table.getByRole('checkbox', { name: `Select ${name}`, exact: true }).isChecked(), true)
      // Selection must not open a profile; keyboard activation belongs to the name control.
      assert.equal(await page.getByRole('dialog').count(), 0)
      const holder = table.getByRole('button', { name: 'Open Kim family', exact: true })
      await holder.focus()
      await page.keyboard.press('Enter')
      const panel = page.getByRole('dialog').first()
      await panel.getByRole('heading', { name: 'Sam Kim', exact: true }).waitFor()
      await panel.getByRole('heading', { name: 'Family', exact: true }).waitFor()
      await panel.getByRole('button', { name: 'Close', exact: true }).click()
      await panel.waitFor({ state: 'hidden' })
      assert.equal(await search.inputValue(), 'Kim')
      assert.equal(await table.getByRole('checkbox', { name: 'Select Sam Kim', exact: true }).isChecked(), true)
      await table.getByRole('checkbox', { name: 'Select all contacts', exact: true }).uncheck()
      const childRow = table.getByRole('row').filter({ has: page.getByRole('button', { name: 'Open Sophie Kim family', exact: true }) })
      // A non-interactive cell opens that student's profile, not the holder's profile.
      await childRow.getByRole('cell').nth(3).click()
      await panel.getByRole('heading', { name: 'Sophie Kim', exact: true }).waitFor()
      await panel.getByRole('heading', { name: 'Contact details', exact: true }).waitFor()
      assert.equal(await panel.getByRole('button', { name: 'Payment methods', exact: true }).count(), 0)
      await panel.getByRole('navigation', { name: 'Family sections', exact: true }).getByRole('button', { name: 'Notes', exact: true }).click()
      await panel.getByRole('button', { name: 'Add note', exact: true }).click()
      await panel.getByPlaceholder('Write a note...').fill('Retained student note draft')
      await panel.getByRole('navigation', { name: 'Family sections', exact: true }).getByRole('button', { name: 'Account', exact: true }).click()
      await panel.getByRole('navigation', { name: 'Family sections', exact: true }).getByRole('button', { name: 'Notes', exact: true }).click()
      assert.equal(await panel.getByPlaceholder('Write a note...').inputValue(), 'Retained student note draft')
      await page.screenshot({ path: `/tmp/odeon-student-current-${width}.png`, fullPage: true })
      await page.goto(`${base}?prototype=v1&view=parent&account=preview:alex-account`)
      await page.getByRole('heading', { name: 'Profile unavailable', exact: true }).waitFor()
      await page.goto(`${base}?prototype=v1&view=staff&account=preview:kim&student=preview:alex`)
      await page.getByRole('heading', { name: 'Profile unavailable', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      assert.deepEqual(errors, [])
      assert.deepEqual(apis, [])
      console.log(`PASS V1 ${width}px: shared contacts table, selection, keyboard/row opening, person scope, retained draft and invalid routes`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
