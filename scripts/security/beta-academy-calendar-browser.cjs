/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/, 'Use an isolated review host only')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(12000)
      const errors = [], requests = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(`${request.method()} ${request.url()}`)
      })
      await page.goto(`${base}/odeon-demo?screen=calendar`)
      await page.getByRole('heading', { name: 'Academy calendar' }).waitFor()
      assert.ok(await page.getByRole('main').count(), 'The calendar stays inside the workspace')
      assert.equal(await page.getByRole('heading', { name: 'Academy calendar' }).evaluate(element => Boolean(element.closest('main'))), true)
      const scheduled = Number((await page.locator('body').innerText()).match(/(\d+) scheduled/)?.[1])
      assert.ok(scheduled > 0, 'The week shows scheduled activity')

      // A block explains itself and offers the owner's actions.
      const block = page.locator('[data-booking-id]').first()
      await block.click()
      await page.getByText('Student', { exact: true }).waitFor()
      assert.ok(await page.getByRole('button', { name: 'View profile', exact: true }).count(), 'The block opens the student')
      assert.ok(await page.getByRole('button', { name: 'Cancel this lesson', exact: true }).count(), 'The block can be cancelled')
      assert.ok(await page.getByRole('button', { name: 'Reschedule', exact: true }).count(), 'The block can be moved')
      assert.ok(await page.getByRole('button', { name: 'Message family by SMS', exact: true }).count(), 'The family can be messaged')

      // Staff filter narrows the week to one teacher.
      await page.getByRole('button', { name: 'Close', exact: true }).last().click()
      await page.waitForTimeout(200)
      await page.getByRole('button', { name: 'Staff: All', exact: true }).click()
      await page.getByRole('group', { name: 'Staff filters' }).getByRole('checkbox').nth(1).check()
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
      const narrowed = Number((await page.locator('body').innerText()).match(/(\d+) scheduled/)?.[1])
      assert.ok(narrowed < scheduled && narrowed > 0, 'The staff filter narrows the week')
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click()

      // Lesson proposals hand off to enrollment; room reservations remain direct.
      await page.getByRole('button', { name: 'Add booking', exact: true }).click()
      const modal = page.getByRole('dialog', { name: 'Add booking', exact: true })
      await modal.getByRole('button', { name: 'Choose Studio booking', exact: true }).click()
      await modal.getByLabel('Room', { exact: true }).selectOption({ label: 'Studio 1 · capacity 1' })
      await modal.getByLabel('Booking date', { exact: true }).fill('2026-11-04')
      await modal.getByLabel('Start time', { exact: true }).selectOption('14:00')
      await modal.getByRole('button', { name: 'Add booking', exact: true }).click()
      await modal.waitFor({ state: 'detached' })
      assert.ok(await page.locator('[data-booking-id*="beta:booking:"]').count(), 'The new booking appears on its selected date')

      // A cancelled lesson stays visible and says so.
      await page.locator('[data-booking-id]:not([data-booking-id*="beta:booking:"])').first().click()
      await page.getByRole('button', { name: 'Cancel this lesson', exact: true }).click()
      await page.waitForTimeout(400)
      assert.ok(await page.locator('[data-cancelled="true"]').count(), 'The cancelled lesson is marked without an extra row')
      assert.deepEqual(errors, [])
      assert.deepEqual(requests, [])
      console.log(`PASS ${width}: workspace calendar shows the week, filters by staff, opens blocks, reserves a room and cancels an existing lesson; no API requests/errors`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
