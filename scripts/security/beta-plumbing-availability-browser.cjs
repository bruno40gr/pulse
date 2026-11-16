/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional UI checks. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/)
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(15000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => route.fulfill({ json: { roleKey: 'owner' } }))

      // Beta onboarding opens the academy's existing configured records without a fixture switch.
      await page.goto(`${base}/odeon-demo/school-setup?section=teachers`)
      await page.getByRole('heading', { name: 'Teachers', exact: true }).waitFor()
      await page.getByRole('heading', { name: 'Maya Chen', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => location.search.includes('experience=')), false)
      await page.goto(`${base}/odeon-demo/school-setup?section=services`)
      await page.getByRole('heading', { name: 'Piano', exact: true }).waitFor()
      await page.screenshot({ path: `/tmp/odeon-plumbing-onboarding-${width}.png`, fullPage: true })

      // Teacher day shows the date-specific hours the calendar and contacts validate, read-only.
      await page.goto(`${base}/odeon-demo?screen=teacher`)
      await page.getByRole('button', { name: 'Availability', exact: true }).click()
      await page.getByText(/Published teaching hours/).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Add availability', exact: true }).count(), 0, 'Only the school office edits availability')
      assert.equal(await page.getByText('Save sample proposal', { exact: true }).count(), 0)
      await page.screenshot({ path: `/tmp/odeon-plumbing-teacher-${width}.png`, fullPage: true })

      // Contacts rescheduling offers only the configured teacher hours, excluding booked lessons.
      await page.goto(`${base}/odeon-demo?view=quick&account=demo%3Afamily-1&section=enrollments`)
      const panel = page.getByRole('dialog', { name: 'Family workspace V3' })
      await panel.waitFor()
      await panel.getByRole('button', { name: 'Next week', exact: true }).click()
      const menu = panel.getByRole('button', { name: 'Emma Piano lesson 2026-11-09 actions', exact: true })
      await menu.waitFor()
      await menu.click()
      await page.getByRole('menuitem', { name: 'Reschedule lesson', exact: true }).click()
      const grid = page.getByRole('region', { name: 'Available lesson times' })
      await grid.waitFor()
      const slot = name => grid.getByRole('button', { name, exact: true })
      await slot('Thursday, Nov 12 2:00 pm, 1 teacher available').waitFor()
      assert.equal(await slot('Thursday, Nov 12 4:30 pm, 1 teacher available').count(), 1)
      assert.equal(await slot('Thursday, Nov 12 3:30 pm, 1 teacher available').count(), 0, 'Maya already teaches at 3:30pm')
      assert.equal(await slot('Thursday, Nov 12 4:00 pm, 1 teacher available').count(), 0, 'Maya already teaches at 4:00pm')
      assert.equal(await grid.getByRole('button', { name: /^Monday, Nov 9 1:00 am/ }).count(), 0)
      await page.screenshot({ path: `/tmp/odeon-plumbing-reschedule-${width}.png`, fullPage: true })

      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}: configured onboarding, date-specific teacher hours and conflict-free reschedule slots`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
