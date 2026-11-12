/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser review. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3227'
assert.match(base, /^http:\/\/127\.0\.0\.1:/, 'Only use an isolated review host')

async function hold(page, button) {
  await button.focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(1700)
  await page.keyboard.up('Space')
}

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        if (route.request().method() !== 'GET') writes.push(route.request().url())
        return route.fulfill({ json: { roleKey: 'owner' } })
      })
      const url = `${base}/odeon-demo?view=quick&account=demo%3Afamily-9&section=enrollments`
      await page.goto(url)
      const panel = page.getByRole('dialog', { name: 'Family workspace V3' })
      await panel.waitFor()
      await panel.getByRole('button', { name: 'Calendar', exact: true }).click()
      await panel.getByRole('button', { name: 'Sara Voice & Vocals lesson 2026-11-04 actions', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Reschedule lesson', exact: true }).click()
      const calendar = panel.getByRole('region', { name: 'Available lesson times' })
      await calendar.getByLabel(/Adam Ibrahim · Guitar · Isabel Rivera/).waitFor()
      await calendar.getByLabel(/Sara Ibrahim.*Original lesson/).waitFor()
      assert.equal(await calendar.getByLabel(/Emma Adams/).count(), 0)
      await panel.getByRole('button', { name: 'Next week', exact: true }).click()
      await calendar.getByLabel(/Adam Ibrahim/).waitFor()
      const slot = calendar.getByRole('button', { name: /teacher.*available/ }).first()
      await slot.click()
      await panel.locator('[data-selected-replacement]').waitFor()
      await calendar.getByLabel(/Adam Ibrahim/).waitFor()
      await page.screenshot({ path: `/tmp/beta-family-reschedule-${width}.png` })
      await hold(page, panel.getByRole('button', { name: 'Reschedule lesson', exact: true }))
      await panel.getByRole('button', { name: 'Calendar', exact: true }).waitFor()
      assert.match(await panel.innerText(), /Nov 9–Nov 14/)
      const savedMove = await page.evaluate(() => JSON.parse(sessionStorage.getItem('odeon:app-sample:v2')))
      const moved = savedMove.snapshot.data.lessons.find(item => item.id === 'demo:enrollment-11:calendar:2026-11-04')
      assert.notEqual(moved.date, '2026-11-04')

      await page.getByRole('button', { name: 'Done', exact: true }).click()
      await panel.getByRole('button', { name: /^Makeups/ }).click()
      const book = panel.getByRole('button', { name: /Schedule Sara makeup/ }).first()
      await book.click()
      await calendar.getByLabel(/Adam Ibrahim/).waitFor()
      await calendar.getByLabel(/Sara Ibrahim/).first().waitFor()
      await calendar.getByRole('button', { name: /teacher.*available/ }).first().click()
      await panel.locator('[data-selected-replacement]').waitFor()
      await page.screenshot({ path: `/tmp/beta-family-makeup-${width}.png` })
      await hold(page, panel.getByRole('button', { name: 'Book makeup', exact: true }))
      await panel.getByRole('button', { name: 'Calendar', exact: true }).waitFor()
      const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('odeon:app-sample:v2')))
      assert.ok(saved.snapshot.makeups.items.find(item => item.id === 'demo:makeup-3').booking)
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      console.log(`PASS ${width}: account-holder reschedule and makeup, siblings visible during selection, original labelled, week retained, confirmed updates, no operational writes or errors`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })