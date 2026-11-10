const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3207'
const RED = 'rgb(220, 38, 38)'

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], apis = []
      page.on('pageerror', e => errors.push(e.message))
      page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) apis.push(r.method() + ' ' + new URL(r.url()).pathname) })
      const red = async locator => assert.equal(await locator.evaluate(n => getComputedStyle(n).backgroundColor), RED, 'Exit is the shared red button')

      await page.goto(`${BASE}/odeon-demo?tenant=bruno`)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      await table.waitFor()
      await table.getByRole('button', { name: 'Emma Adams', exact: true }).waitFor()
      const parent = table.getByRole('button', { name: 'Alex Adams', exact: true })
      const child = table.getByRole('button', { name: 'Emma Adams', exact: true })
      assert.ok(Math.abs((await parent.boundingBox()).x - (await child.boundingBox()).x) < 2, 'No indentation')
      const groups = table.locator('[role="rowgroup"]').filter({ has: page.locator('[role="cell"]') })
      const first = groups.nth(0).locator('[role="row"]').first(), second = groups.nth(1).locator('[role="row"]').first()
      const bg = el => el.evaluate(n => getComputedStyle(n).backgroundColor)
      assert.notEqual(await bg(first), await bg(second), 'Zebra base')
      await first.hover()
      assert.notEqual(await first.evaluate(n => getComputedStyle(n).boxShadow), 'none', 'Hover overlay')
      await page.screenshot({ path: `/tmp/beta-official-contacts-${width}.png`, fullPage: true })
      await child.click()
      await page.getByRole('dialog', { name: 'Family workspace V3' }).waitFor()
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).first().click()
      if (width < 700) await page.getByRole('button', { name: /menu/i }).first().click()
      await page.getByRole('img', { name: 'Headliner logo', exact: true }).first().waitFor()
      const exit = page.getByRole('button', { name: 'Back to Headliner', exact: true })
      await exit.waitFor()
      await red(exit)
      const nav = page.getByRole('navigation').first()
      for (const label of ['Contacts', 'Parent portal', 'School Setup']) assert.equal(await nav.getByRole('link', { name: label, exact: true }).count(), 1, `${label} is a Beta destination`)
      assert.equal(await page.getByRole('link', { name: 'Staff', exact: true }).count(), 0)
      assert.equal(await page.getByText('Odeon Music Academy', { exact: true }).count(), 0)
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)

      await page.goto(`${BASE}/odeon-demo?view=parent&account=demo%3Afamily-1&tenant=bruno`)
      await page.getByRole('img', { name: 'Headliner', exact: true }).waitFor()
      assert.equal(await page.getByText(/Interactive preview/).count(), 0, 'No sandbox disclaimer in the parent portal')
      const portal = page.locator('[data-parent-portal]')
      const parentExit = portal.getByRole('button', { name: 'Back to Headliner', exact: true })
      await parentExit.waitFor()
      await red(parentExit)
      await page.screenshot({ path: `/tmp/beta-parent-portal-${width}.png` })

      await page.goto(`${BASE}/odeon-demo/school-setup?experience=configured&tenant=bruno`)
      const setupExit = page.getByRole('button', { name: 'Back to Headliner', exact: true })
      await setupExit.waitFor()
      await red(setupExit)
      assert.match(await page.getByRole('link', { name: 'Headliner', exact: true }).getAttribute('href'), /^\/dashboard\?.*tenant=bruno/)
      await page.screenshot({ path: `/tmp/beta-school-setup-${width}.png` })
      assert.deepEqual(errors, [])
      assert.deepEqual(apis.filter(path => path !== 'GET /api/account/me'), [])
      console.log('PASS ' + width + ' official table, stripes+hover, no indent, V3, Headliner logo, red exits, three Beta destinations, tenant preserved, no operational API calls')
      await page.close()
    }
  } finally {
    await browser.close()
  }
})().catch(e => { console.error(e); process.exit(1) })
