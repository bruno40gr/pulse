/* eslint-disable @typescript-eslint/no-require-imports -- Local prototype regression journey. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.STUDENT_REVIEW_URL || 'http://127.0.0.1:3197/students'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local lab required')

;(async () => {
  const browser = await chromium.launch()
  try {
    for (const version of ['', '?prototype=v2']) for (const width of [1440, 900, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 768 }, serviceWorkers: 'block' })
      const page = await context.newPage(), errors = [], apis = []
      page.setDefaultTimeout(10000)
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
      await page.goto(`${base}${version}`)
      await page.getByRole('button', { name: 'Open Kim family', exact: true }).click()
      const panel = page.getByRole('dialog').first()
      await panel.getByRole('heading', { name: 'Sam Kim', exact: true }).waitFor()
      assert.equal(await panel.getByText(/Family profile/i).count(), 0)
      await panel.locator('[data-profile-subtitle]').getByText('Account manager', { exact: true }).waitFor()
      assert.equal(await panel.getByRole('heading', { name: 'Account managers', exact: true }).count(), 0)
      const contact = panel.getByRole('heading', { name: 'Contact details', exact: true }).locator('..').locator('..')
      for (const label of ['Name', 'Email', 'Phone']) await contact.getByText(label, { exact: true }).waitFor()
      await contact.getByText('sam.kim@example.invalid', { exact: true }).waitFor()
      const family = panel.getByRole('heading', { name: 'Family', exact: true }).locator('..').locator('..')
      for (const name of ['Sophie Kim', 'Ethan Kim']) {
        const details = family.getByRole('region', { name: `${name} family details`, exact: true })
        await details.getByText('Birthday', { exact: true }).waitFor()
        await details.getByText('Subscriptions', { exact: true }).waitFor()
      }
      await family.getByRole('region', { name: 'Sophie Kim family details', exact: true }).getByText('2', { exact: true }).waitFor()
      await family.getByRole('region', { name: 'Ethan Kim family details', exact: true }).getByText('1', { exact: true }).waitFor()
      assert.equal(await family.getByRole('button', { name: /enrollments|makeups|notes/i }).count(), 0)
      const subscriptions = panel.getByRole('region', { name: 'Current subscriptions', exact: true })
      for (const [name, count] of [['Sophie Kim', 2], ['Ethan Kim', 1]]) {
        const group = subscriptions.getByRole('region', { name: `${name} subscriptions`, exact: true })
        await group.getByRole('heading', { name, level: 2, exact: true }).waitFor()
        assert.equal(await group.getByRole('button', { name: /subscription actions$/ }).count(), count)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
      await page.screenshot({ path: `/tmp/odeon-account-manager-${version ? 'v2' : 'v1'}-${width}.png`, fullPage: true })
      const upcomingLabel = version ? 'Upcoming lessons' : 'Upcoming classes'
      await panel.getByRole('button', { name: upcomingLabel, exact: true }).click()
      for (const name of ['Select Sophie Piano lesson 2026-11-03', 'Select Sophie Voice lesson 2026-11-05', 'Select Ethan Guitar lesson 2026-11-06']) await panel.getByRole('button', { name, exact: true }).waitFor()
      assert.equal(await panel.getByRole('button', { name: 'All students', exact: true }).count(), 0)
      assert.equal(await panel.getByRole('button', { name: /^(Sophie|Ethan) Kim$/ }).count(), 0)
      await panel.getByRole('button', { name: 'View calendar', exact: true }).click()
      await page.getByRole('heading', { name: 'Calendar', level: 1, exact: true }).waitFor()
      await page.getByRole('button', { name: 'Back to Sam Kim', exact: true }).click()
      await panel.getByRole('button', { name: 'Select Ethan Guitar lesson 2026-11-06', exact: true }).waitFor()
      await panel.getByRole('button', { name: 'Notes', exact: true }).click()
      const notes = panel.getByRole('region', { name: 'Account notes', exact: true })
      assert.equal(await notes.getByRole('button', { name: /Open .* notes/ }).count(), 0)
      await notes.getByRole('button', { name: 'Add note', exact: true }).click()
      await notes.getByPlaceholder('Write a note...').fill('Sam account-wide regression note')
      await notes.getByRole('button', { name: 'Save note', exact: true }).click()
      await notes.getByText('Sam account-wide regression note', { exact: true }).waitFor()
      await panel.getByRole('button', { name: 'Account', exact: true }).click()
      await panel.getByRole('button', { name: 'Notes', exact: true }).click()
      await notes.getByText('Sam account-wide regression note', { exact: true }).waitFor()
      await panel.getByRole('button', { name: 'Account', exact: true }).click()
      await family.getByRole('button', { name: 'Add a child', exact: true }).click()
      await page.getByRole('heading', { name: 'Add child', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Back to Sam Kim', exact: true }).click()
      await panel.getByRole('heading', { name: 'Sam Kim', exact: true }).waitFor()
      await family.getByRole('button', { name: 'Add a child', exact: true }).click()
      await page.getByLabel('First name', { exact: true }).fill('Ella')
      await page.getByLabel('Last name', { exact: true }).fill('Kim')
      await page.getByLabel('Birthday', { exact: true }).fill('2017-05-20')
      await page.getByRole('button', { name: 'Add child', exact: true }).click()
      const addedChild = family.getByRole('region', { name: 'Ella Kim family details', exact: true })
      await addedChild.getByText('May 20, 2017', { exact: true }).waitFor()
      await addedChild.getByText('0', { exact: true }).waitFor()
      if (version) await panel.getByRole('button', { name: 'Book makeup', exact: true }).click()
      else await panel.getByRole('button', { name: /^Makeups/ }).click()
      const makeupRoot = version ? page.getByRole('dialog', { name: 'Family workspace V2', exact: true }) : panel
      await makeupRoot.getByRole('heading', { name: 'Sophie Kim', exact: true }).last().waitFor()
      await makeupRoot.getByRole('heading', { name: 'Ethan Kim', exact: true }).last().waitFor()
      assert.equal(await makeupRoot.getByRole('button', { name: 'All students', exact: true }).count(), 0)
      await makeupRoot.getByRole('button', { name: /^Schedule Sophie makeup/ }).first().click()
      await page.getByRole('heading', { name: 'Schedule makeup', level: 1, exact: true }).waitFor()
      await page.getByRole('button', { name: 'Back to Sam Kim', exact: true }).click()
      await makeupRoot.getByRole('heading', { name: 'Ethan Kim', exact: true }).last().waitFor()
      assert.deepEqual(errors, [])
      assert.deepEqual(apis, [])
      console.log(`PASS account-manager contact/family, grouped subscriptions, combined lessons/makeups, account notes and task returns ${version ? 'V2' : 'V1'} ${width}px`)
      await context.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
