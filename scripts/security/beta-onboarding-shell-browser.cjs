/* eslint-disable @typescript-eslint/no-require-imports -- Isolated sample browser checks. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/)
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1920, 1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(10000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${base}/odeon-demo/school-setup?experience=configured`)
      const content = page.locator('#setup-content')
      await content.waitFor()
      if (width === 390) {
        await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        await page.getByRole('dialog', { name: 'School navigation', exact: true }).waitFor()
      }
      const nav = page.getByRole('navigation', { name: 'School onboarding sections', exact: true })
      await nav.waitFor()
      assert.ok((await nav.boundingBox()).y < 240, 'Section links follow the switcher without a centered spacer')
      const sidebar = await nav.locator('..').boundingBox()
      assert.equal(sidebar.x, 0, 'Sidebar is pinned to the left, not centered')
      assert.equal(sidebar.y, 0, 'Sidebar starts at the viewport top like the app')
      if (width !== 390) {
        assert.equal(sidebar.width, 252, 'Uses the operational app sidebar width')
        const bounds = await content.boundingBox()
        assert.equal(bounds.x, 252)
        assert.equal(bounds.width, width - 252, 'Content fills the remaining workspace')
      }
      await page.getByRole('button', { name: /School onboarding/, exact: true }).click()
      const areas = page.getByRole('group', { name: 'Choose a work area', exact: true })
      await areas.waitFor()
      assert.equal(await areas.getByText('School Setup', { exact: true }).count(), 0)
      await page.keyboard.press('Escape')
      await nav.getByRole('button', { name: 'Teachers', exact: true }).click()
      await content.getByRole('heading', { name: 'Teachers', exact: true }).waitFor()
      if (width === 390) {
        await page.getByRole('dialog', { name: 'School navigation', exact: true }).waitFor({ state: 'hidden' })
        await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        await page.keyboard.press('Escape')
        await page.getByRole('dialog', { name: 'School navigation', exact: true }).waitFor({ state: 'hidden' })
        assert.equal(await page.getByRole('button', { name: 'Open menu', exact: true }).evaluate(element => element === document.activeElement), true)
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `/tmp/odeon-onboarding-shell-${width}.png`, fullPage: true })
      console.log(`PASS ${width}: onboarding app-aligned shell, no duplicate area, sections navigation, no overflow/errors`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })