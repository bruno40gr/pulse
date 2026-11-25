/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic shared-picker fixture, no provider calls. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], requests = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => { requests.push(route.request().url()); return route.abort() })
      await page.goto(process.env.PEOPLE_PICKER_REVIEW_URL || 'http://127.0.0.1:3271/people-picker-review')
      const dialog = page.getByRole('dialog', { name: 'People picker review' })
      const results = dialog.getByRole('region', { name: 'People results' })
      const search = dialog.getByRole('searchbox', { name: 'Search contacts' })
      for (const workflow of ['Family', 'Band', 'Event']) {
        await dialog.getByRole('combobox', { name: 'Workflow' }).selectOption(workflow)
        await results.getByText('Parent', { exact: true }).waitFor()
        await results.getByText('Account holder', { exact: true }).waitFor()
        await results.getByText('Another family', { exact: true }).waitFor()
        assert.equal(await results.getByText('sam@example.invalid', { exact: true }).count(), 0)
        const details = results.locator('span[title]')
        for (const text of await details.allTextContents()) assert.ok(text.trim().split(/\s+/).length <= 2)
        assert.equal(await results.getByText('Another family', { exact: true }).getAttribute('title'), 'Family merging is not supported')
        await search.fill('5553334444')
        await results.getByText('Alex Example', { exact: true }).waitFor()
        assert.equal(await results.getByText('Sam Kim', { exact: true }).count(), 0)
        await search.fill('alex@')
        await results.getByText('Alex Example', { exact: true }).waitFor()
        await search.fill('')
        const selection = results.getByRole(workflow === 'Family' ? 'radio' : 'checkbox', { name: /Alex Example/ })
        await selection.check()
        await dialog.getByRole('status').filter({ hasText: '1 selected' }).waitFor()
        assert.equal(await dialog.getByRole('button', { name: 'Add selected' }).isEnabled(), true)
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        await page.screenshot({ path: `/tmp/people-picker-${workflow.toLowerCase()}-${width}.png` })
      }
      assert.deepEqual(errors, [])
      assert.deepEqual(requests, [])
      console.log(`PASS ${width}px: family/band/event shared picker, relationships, two-word statuses, hidden metadata search, selection, overflow; synthetic only`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })