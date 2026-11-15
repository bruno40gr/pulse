/* eslint-disable @typescript-eslint/no-require-imports -- Sample Contacts lesson-card regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.BASE_URL || 'http://127.0.0.1:3231'
assert.match(base, /^http:\/\/127\.0\.0\.1:/)
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome' })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(10000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${base}/odeon-demo`)
      await page.getByRole('button', { name: 'Emma Adams', exact: true }).click()
      const profile = page.getByRole('dialog', { name: 'Family workspace V3', exact: true })
      await profile.getByRole('button', { name: 'Schedule & lessons', exact: true }).click()
      await profile.getByLabel('Lesson date view', { exact: true }).selectOption('all')
      const lesson = profile.getByRole('button', { name: /^Select Emma .* lesson / }).first()
      await lesson.click()
      assert.equal(await lesson.getAttribute('aria-pressed'), 'true')
      await profile.getByRole('button', { name: /Emma .* lesson .* actions/ }).first().click()
      await page.getByRole('menuitem', { name: 'Reschedule lesson', exact: true }).waitFor()
      await page.getByRole('menuitem', { name: 'Cancel lesson', exact: true }).waitFor()
      await page.keyboard.press('Escape')
      const include = profile.getByRole('checkbox', { name: /^Include Emma / }).first()
      await include.check()
      assert.equal(await include.isChecked(), true)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      assert.deepEqual(errors, [])
      await page.screenshot({ path: `/tmp/odeon-shared-contact-lesson-${width}.png` })
      console.log(`PASS ${width}: Contacts shared lesson selection/actions, no overflow/errors`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })