/* eslint-disable @typescript-eslint/no-require-imports -- Local fictional browser regression. */
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
      const navigate = async (label, heading = label) => {
        if (width === 390) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
        await page.getByRole('link', { name: label, exact: true }).click()
        await page.getByRole('heading', { name: heading, exact: true }).first().waitFor()
      }
      await page.goto(`${base}/odeon-demo`)
      const resultStyles = []
      for (const [view, first] of [['Contact view', 'View students'], ['Lead view', 'View students']]) {
        if (view === 'Lead view') await navigate('Opportunities', 'Leads')
        const toggle = page.getByRole('group', { name: view, exact: true })
        await toggle.getByRole('button', { name: first, exact: true }).click()
        await toggle.getByRole('button', { name: 'View families', exact: true }).click()
        const discovery = page.getByRole('group', { name: 'Table discovery', exact: true })
        const search = discovery.getByRole('searchbox')
        await search.fill('No matching fixture')
        await discovery.getByRole('button', { name: 'Search', exact: true }).click()
        await discovery.getByRole('button', { name: 'Clear search', exact: true }).click()
        await discovery.getByRole('button', { name: 'Filters', exact: true }).click()
        const drawer = page.getByRole('dialog')
        await drawer.getByLabel('Name', { exact: true }).fill('Unsubmitted filter')
        await drawer.getByRole('button', { name: 'Clear filters', exact: true }).click()
        await drawer.getByRole('button', { name: 'Submit search', exact: true }).click()
        const preferences = discovery.getByRole('button', { name: 'Table preferences', exact: true })
        assert.equal(await preferences.locator('svg').count(), 2, 'Leading table icon and trailing chevron')
        if (width === 1440) {
          const tops = await Promise.all([search, discovery.getByRole('button', { name: 'Filters', exact: true }), toggle, preferences].map(item => item.boundingBox().then(box => box.y + box.height / 2)))
          assert.ok(Math.max(...tops) - Math.min(...tops) < 2, 'All discovery controls share a single row')
        }
        if (view === 'Lead view') {
          assert.equal(await page.getByLabel('Filter leads by status', { exact: true }).count(), 0)
          assert.equal(await page.getByRole('button', { name: 'Export CSV', exact: true }).count(), 0)
          await preferences.click()
          await page.getByRole('group', { name: 'Table actions', exact: true }).getByRole('button', { name: 'Export CSV', exact: true }).waitFor()
          await page.keyboard.press('Escape')
          await page.getByRole('button', { name: '+ Add lead', exact: true }).click()
          await page.getByRole('dialog').waitFor()
          await page.keyboard.press('Escape')
        }
        const geometry = await toggle.evaluate(element => {
          const outer = element.getBoundingClientRect()
          return [...element.querySelectorAll('button')].every(button => {
            const inner = button.getBoundingClientRect()
            return inner.top >= outer.top + 3 && inner.bottom <= outer.bottom - 3
          })
        })
        assert.equal(geometry, true, 'Segment border remains fully inset')
        const results = page.locator('[data-table-results]').filter({ visible: true }).first()
        resultStyles.push(await results.getByRole('status').evaluate(element => {
          const style = getComputedStyle(element)
          return [style.color, style.fontSize, style.fontWeight, getComputedStyle(element.closest('[data-table-results]')).minHeight]
        }))
        await page.screenshot({ path: `/tmp/odeon-${view === 'Lead view' ? 'leads' : 'contacts'}-periphery-${width}.png` })
      }
      assert.deepEqual(resultStyles[0], resultStyles[1], 'Counts share typography and reserved geometry')
      assert.equal(await page.getByText(/^Viewing \d+ loaded/).count(), 0)
      assert.equal(await page.getByText(/^\d+ leads?$/).count(), 0)
      for (const [destination, action, label, name] of [
        ['Events', 'Create event', 'Event name', 'Draft recital'],
        ['Bands & ensembles', 'Create new band', 'Band name', 'Draft ensemble'],
      ]) {
        await navigate(destination)
        await page.getByRole('button', { name: action, exact: true }).click()
        await page.getByLabel(label, { exact: true }).fill(name)
        await page.getByRole('button', { name: 'Save & close', exact: true }).click()
        await page.getByRole('heading', { name: destination, exact: true }).first().waitFor()
        await page.getByRole('button', { name, exact: true }).click()
        await page.getByLabel(label, { exact: true }).waitFor()
        assert.equal(await page.getByLabel(label, { exact: true }).inputValue(), name)
        await page.getByRole('button', { name: 'Save & close', exact: true }).click()
      }
      await navigate('Enroll & Book')
      assert.equal(await page.getByText('Draft recital', { exact: true }).count(), 0)
      assert.equal(await page.getByText('Draft ensemble', { exact: true }).count(), 0)
      await page.reload()
      await navigate('Events')
      await page.getByRole('button', { name: 'Draft recital', exact: true }).waitFor()
      await navigate('Bands & ensembles')
      await page.getByRole('button', { name: 'Draft ensemble', exact: true }).waitFor()
      assert.deepEqual(errors, [])
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false)
      console.log(`PASS ${width}: inset segmented toggles, matching count styles, no header count, event/group drafts resume only in their own workspaces`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })