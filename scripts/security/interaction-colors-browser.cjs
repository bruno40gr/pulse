/* eslint-disable @typescript-eslint/no-require-imports -- Isolated UI review host only. */
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
      await page.goto(`${base}/interaction-review`)
      const electric = 'rgb(0, 190, 223)'
      const focus = 'rgb(0, 103, 122)'
      const ink = 'rgb(26, 19, 15)'
      const accent = locator => locator.evaluate(element => getComputedStyle(element).accentColor)
      const background = locator => locator.evaluate(element => getComputedStyle(element).backgroundColor)
      const checkbox = page.getByLabel('Include existing student', { exact: true })
      await checkbox.waitFor()
      assert.equal(await accent(checkbox), electric)
      await checkbox.uncheck()
      await checkbox.focus()
      await page.keyboard.press('Space')
      assert.equal(await checkbox.isChecked(), true)
      const partial = page.getByLabel('Partially selected rows', { exact: true })
      assert.equal(await partial.evaluate(element => element.indeterminate), true)
      assert.equal(await accent(partial), electric)
      const radio = page.getByRole('radio', { name: 'Group', exact: true })
      await radio.check()
      assert.equal(await accent(radio), electric)
      assert.equal(await radio.isChecked(), true)
      const toggle = page.getByRole('switch', { name: 'Enable booking', exact: true })
      assert.equal(await background(toggle), electric)
      await toggle.click()
      assert.equal(await toggle.isChecked(), false)
      await toggle.focus()
      await page.keyboard.press('Space')
      await page.waitForFunction(() => {
        const control = document.querySelector('input[role="switch"][aria-label="Enable booking"]')
        return control && getComputedStyle(control).backgroundColor === 'rgb(0, 190, 223)'
      })
      assert.equal(await background(toggle), electric)
      assert.equal(await background(page.getByRole('button', { name: 'Wednesday', exact: true }).locator('span')), electric)
      const step = page.locator('ol[aria-label="Progress"] li').nth(1).locator('span').first()
      assert.equal(await background(step), electric)
      assert.equal(await step.evaluate(element => getComputedStyle(element).color), ink)
      const selectedDay = page.getByRole('button', { name: 'Wednesday', exact: true }).locator('span')
      assert.equal(await selectedDay.evaluate(element => getComputedStyle(element).color), ink)
      await page.getByRole('button', { name: 'Open example search', exact: true }).click()
      const search = page.getByRole('combobox', { name: 'Find example person' })
      await search.focus()
      assert.equal(await search.evaluate(element => getComputedStyle(element).boxShadow), 'none', 'No duplicate inset focus ring')
      assert.equal(await search.evaluate(element => getComputedStyle(element).outlineColor), focus)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: 'Open example search', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Primary action', exact: true }).focus()
      assert.equal(await page.getByRole('button', { name: 'Primary action', exact: true }).evaluate(element => getComputedStyle(element).outlineColor), focus)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      await page.emulateMedia({ forcedColors: 'active' })
      await toggle.focus()
      assert.notEqual(await toggle.evaluate(element => getComputedStyle(element).outlineStyle), 'none')
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}: token colors, native mixed selection, keyboard controls, search, focus and forced colors`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
