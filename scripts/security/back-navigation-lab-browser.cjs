/* eslint-disable @typescript-eslint/no-require-imports -- Local, isolated design review. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = []; const writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => { writes.push(route.request().url()); return route.fulfill({ json: {} }) })
      await page.goto(process.env.BACK_NAVIGATION_REVIEW_URL || 'http://127.0.0.1:3102/dashboard/design/back-navigation')
      await page.getByRole('heading', { name: 'Back navigation lab', exact: true }).waitFor()
      assert.equal(await page.getByRole('article').count(), 14)
      for (const look of ['Chevron only', 'Plain + arrow', 'Underlined link', 'Outlined button']) {
        await page.getByRole('button', { name: look, exact: true }).click()
        for (const placement of ['Above title', 'Beside title', 'Current locations']) {
          await page.getByRole('button', { name: placement, exact: true }).click()
          for (const preview of ['Desktop', 'Mobile']) {
            await page.getByRole('button', { name: preview, exact: true }).click()
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}: no overflow with ${look}/${placement}/${preview}`)
          }
        }
      }
      await page.getByRole('button', { name: 'Beside title', exact: true }).click()
      await page.getByRole('button', { name: 'Chevron only', exact: true }).click()
      const firstBack = page.getByRole('article').first().getByRole('button', { name: 'Back to lead', exact: true })
      await firstBack.hover()
      await page.getByRole('tooltip', { name: 'Back to lead', exact: true }).waitFor()
      await page.mouse.move(0, 0)
      await firstBack.focus()
      await page.getByRole('tooltip', { name: 'Back to lead', exact: true }).waitFor()
      const header = await firstBack.evaluate(button => {
        const title = button.closest('header').querySelector('h3').getBoundingClientRect()
        const bounds = button.getBoundingClientRect()
        return { width: bounds.width, height: bounds.height, aligned: bounds.top <= title.bottom && bounds.bottom >= title.top }
      })
      assert.ok(header.width >= 44 && header.height >= 44 && header.aligned)

      for (const article of await page.getByRole('article').all()) {
        await article.getByRole('button', { name: /^Back to / }).click()
        await article.getByRole('status').waitFor()
        await article.getByRole('button', { name: 'Reopen example', exact: true }).click()
        await article.getByRole('button', { name: 'Close example', exact: true }).click()
        await article.getByText('Drawer / view closed', { exact: true }).waitFor()
      }
      await page.getByRole('button', { name: 'Reset examples', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Close example', exact: true }).count(), 14)
      await page.screenshot({ path: `/tmp/pulse-back-navigation-lab-${width}.png`, fullPage: true })
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${width}: 14 examples, all 24 appearance/placement/width combinations, chevron hover/focus tooltip and title alignment, Back/Close/reset, no overflow or API calls`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })