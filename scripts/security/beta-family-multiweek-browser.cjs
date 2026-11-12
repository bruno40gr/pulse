/* eslint-disable @typescript-eslint/no-require-imports -- Isolated sample workflow. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3227'
assert.match(base, /^http:\/\/127\.0\.0\.1:/)

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1100 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        if (route.request().method() !== 'GET') writes.push(route.request().url())
        return route.fulfill({ json: { roleKey: 'owner' } })
      })
      await page.goto(`${base}/odeon-demo?view=quick&account=demo%3Afamily-9&section=enrollments`)
      const panel = page.getByRole('dialog', { name: 'Family workspace V3' })
      const dates = panel.getByRole('combobox', { name: 'Lesson date view' })
      await dates.selectOption('all')
      await panel.getByRole('checkbox', { name: 'Include Adam Guitar lesson 2026-11-17', exact: true }).waitFor()
      assert.ok(await panel.getByRole('checkbox', { name: /Include Adam/ }).count() > 3)
      const lesson = panel.getByRole('button', { name: 'Select Adam Guitar lesson 2026-11-03', exact: true })
      assert.match(await lesson.innerText(), /Adam · Guitar/)
      const alignment = await lesson.evaluate(element => {
        const header = element.parentElement
        const teacher = header.nextElementSibling
        const checkbox = header.querySelector('input')
        return { content: element.getBoundingClientRect().left, teacher: teacher.getBoundingClientRect().left, gap: element.getBoundingClientRect().left - checkbox.getBoundingClientRect().right }
      })
      assert.ok(Math.abs(alignment.content - alignment.teacher) <= 4, 'Staff row is indented to content')
      assert.ok(alignment.gap >= 14, 'Checkbox has a clear content gutter')
      await dates.selectOption('range')
      await panel.getByLabel('From date', { exact: true }).fill('2026-11-03')
      await panel.getByLabel('Through date', { exact: true }).fill('2026-11-17')
      assert.equal(await panel.getByRole('checkbox', { name: /Include Adam/ }).count(), 3)
      assert.equal(await panel.getByRole('checkbox', { name: /2026-11-18/ }).count(), 0)
      for (const date of ['2026-11-03', '2026-11-10', '2026-11-17']) await panel.getByRole('checkbox', { name: `Include Adam Guitar lesson ${date}`, exact: true }).check()
      await page.screenshot({ path: `/tmp/beta-multiweek-list-${width}.png`, fullPage: true })
      await panel.getByRole('button', { name: 'Calendar', exact: true }).click()
      assert.equal(await dates.isDisabled(), true)
      assert.equal(await dates.inputValue(), 'week')
      await panel.getByRole('button', { name: 'List', exact: true }).click()
      assert.equal(await dates.inputValue(), 'range')
      await panel.getByRole('button', { name: 'Reschedule together', exact: true }).click()
      const planner = panel.getByRole('region', { name: 'Reschedule together', exact: true })
      const cards = planner.getByRole('group', { name: 'Lessons to reschedule' }).getByRole('button', { name: 'Plan Adam Guitar', exact: true })
      assert.equal(await cards.count(), 3)
      const calendar = planner.getByRole('region', { name: 'Available lesson times' })
      const expectedDates = []
      for (let index = 0; index < 3; index++) {
        // Click the lower body of the card, not its title.
        const box = await cards.nth(index).boundingBox()
        await cards.nth(index).click({ position: { x: box.width / 2, y: box.height - 12 } })
        assert.equal(await cards.nth(index).getAttribute('aria-pressed'), 'true')
        const slot = calendar.getByRole('button', { name: /teacher.*available/ }).first()
        await slot.click()
        const selected = planner.locator('[data-selected-replacement]')
        expectedDates.push(await selected.getAttribute('data-calendar-date'))
      }
      assert.deepEqual(expectedDates, ['2026-11-04', '2026-11-09', '2026-11-16'], 'Focus jumps to each original week')
      await planner.getByRole('button', { name: 'Confirm 3 changes', exact: true }).waitFor()
      assert.equal(await planner.getByRole('button', { name: 'Undo change', exact: true }).count(), 0)
      assert.equal(await planner.getByRole('button', { name: 'Clear Adam change', exact: true }).count(), 3)
      await cards.nth(0).focus()
      await page.keyboard.press('Enter')
      assert.equal(await planner.locator('[data-selected-replacement]').getAttribute('data-calendar-date'), expectedDates[0], 'Keyboard focus jumps to proposed week')
      await planner.getByRole('button', { name: 'Next week', exact: true }).click()
      await cards.nth(0).click()
      assert.equal(await planner.locator('[data-selected-replacement]').getAttribute('data-calendar-date'), expectedDates[0], 'Clicking the already-focused card restores its week')
      await page.screenshot({ path: `/tmp/beta-multiweek-planner-${width}.png`, fullPage: true })
      await planner.getByRole('button', { name: 'Clear Adam change', exact: true }).nth(1).click()
      assert.equal(await cards.nth(0).getAttribute('aria-pressed'), 'true', 'Clear does not focus a different card')
      await planner.getByRole('button', { name: 'Confirm 2 changes', exact: true }).waitFor()
      await cards.nth(1).click()
      await calendar.getByRole('button', { name: /teacher.*available/ }).first().click()
      const confirm = planner.getByRole('button', { name: 'Confirm 3 changes', exact: true })
      await confirm.focus(); await page.keyboard.down('Space'); await page.waitForTimeout(1700); await page.keyboard.up('Space')
      await page.getByRole('dialog', { name: 'Confirmation', exact: true }).waitFor()
      const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('odeon:app-sample:v2')).snapshot.data.lessons)
      for (const [index, date] of ['2026-11-03', '2026-11-10', '2026-11-17'].entries()) assert.equal(saved.find(item => item.id === `demo:enrollment-10:calendar:${date}`).date, expectedDates[index])
      assert.deepEqual(errors, []); assert.deepEqual(writes, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      console.log(`PASS ${width}: all weeks, date range, list alignment, three-week selection/commit, whole-card and keyboard focus, week jumps, independent clear, no writes/errors/overflow`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })