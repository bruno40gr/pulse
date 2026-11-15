/* eslint-disable @typescript-eslint/no-require-imports -- Isolated fictional browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/)

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const geometry = async () => page.locator('h1').first().evaluate(element => {
        const rect = element.getBoundingClientRect()
        return { x: rect.x, y: rect.y }
      })
      const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `Overflow at ${width}`)
      const taskGeometry = async (mode = 'focused') => {
        const task = page.locator('[data-wizard-layout]')
        await task.waitFor()
        assert.equal(await task.getAttribute('data-width'), mode)
        const bounds = await task.evaluate(element => {
          const rect = element.getBoundingClientRect()
          const parent = element.parentElement
          const outer = parent.getBoundingClientRect()
          const css = getComputedStyle(parent)
          const left = outer.left + parseFloat(css.paddingLeft)
          const right = outer.right - parseFloat(css.paddingRight)
          return { x: rect.x, width: rect.width, center: rect.x + rect.width / 2, availableCenter: (left + right) / 2, availableWidth: right - left }
        })
        assert.ok(Math.abs(bounds.center - bounds.availableCenter) < 1, 'Wizard centered within workspace content, not viewport')
        assert.ok(Math.abs(bounds.width - Math.min(bounds.availableWidth, mode === 'focused' ? 800 : 1100)) < 1)
        const heading = await geometry()
        assert.ok(Math.abs(heading.x - bounds.x) < 1, 'Title aligns to task column')
        assert.equal(await page.locator('ol[aria-label="Progress"]:visible').count(), width > 640 ? 1 : 0)
        assert.equal(await page.getByRole('group', { name: 'Choose step', exact: true }).count(), width > 640 ? 0 : 1)
        await fits()
        return bounds
      }
      await page.goto(`${base}/odeon-demo`)
      await page.getByRole('heading', { name: 'Contacts', exact: true }).waitFor()
      const axis = await geometry()
      for (const [screen, title] of [['opportunities', 'Leads'], ['book', 'Enroll & Book'], ['calendar', 'Academy calendar']]) {
        await page.goto(`${base}/odeon-demo?screen=${screen}`)
        await page.getByRole('heading', { name: title, exact: true }).waitFor()
        assert.deepEqual(await geometry(), axis, `${title} inherits the page axis`)
        if (screen === 'opportunities') assert.equal(await page.getByRole('textbox', { name: 'Search contacts and students', exact: true }).count(), 1)
        if (screen === 'calendar') assert.ok(await page.locator('main h1').count(), 'Calendar belongs to the workspace')
        await fits()
      }
      for (const [choice, title] of [['Private lessons', 'Enroll a student'], ['Single lesson / trial', 'Single lesson / trial'], ['Band', 'Band enrollment'], ['Event registration', 'Event']]) {
        await page.goto(`${base}/odeon-demo?screen=book`)
        await page.getByRole('button', { name: 'Enroll', exact: true }).click()
        await page.getByRole('button', { name: `Choose ${choice}`, exact: true }).click()
        await page.locator('nav[aria-label="Enrollment steps"]').waitFor()
        await taskGeometry()
        assert.equal(await page.locator('h1').first().innerText(), title)
        assert.equal(await page.locator('.pulse-back-control').count(), 0, 'No title back chevrons')
        await fits()
        if (choice === 'Single lesson / trial') {
          await page.getByRole('radio', { name: 'Existing contact', exact: true }).check()
          console.log('Single/trial uses the shared enrollment wizard')
        }
      }
      await page.goto(`${base}/odeon-demo`)
      await page.getByRole('checkbox', { name: 'Select Alex Adams', exact: true }).check()
      await page.getByRole('button', { name: 'Create band', exact: true }).click()
      await page.getByRole('heading', { name: 'Create band', exact: true }).waitFor()
      await taskGeometry()
      assert.equal(await page.locator('.pulse-back-control').count(), 0)
      await fits()
      // The booking calendar gets room without changing dashboard geometry or draft state.
      await page.goto(`${base}/odeon-demo`)
      await page.getByRole('checkbox', { name: 'Select Alex Adams', exact: true }).check()
      await page.getByRole('button', { name: 'Enroll', exact: true }).click()
      const focused = await taskGeometry()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await taskGeometry()
      assert.equal(await page.locator('h1').evaluate(element => element === document.activeElement), true, 'Step navigation focuses heading')
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      const expanded = await taskGeometry('expanded')
      assert.ok(expanded.width >= focused.width)
      await page.getByRole('button', { name: 'Back', exact: true }).click()
      await taskGeometry()
      await page.getByRole('button', { name: 'Continue', exact: true }).click()
      await taskGeometry('expanded')
      assert.ok(await page.locator('button[class*="openSlot"]').count(), 'Calendar survives back/continue')
      assert.deepEqual(errors, [])
      console.log(`PASS shared layout at ${width}px`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
