/* eslint-disable @typescript-eslint/no-require-imports -- Node browser verification. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(10000)
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const check = async section => {
        const rows = page.locator('main [data-labeled-field]')
        await rows.first().waitFor()
        assert.ok(await rows.count(), `${section} exposes labeled fields`)
        for (const row of await rows.all()) {
          const label = row.locator(':scope > label')
          const control = row.locator(':scope > input, :scope > select, :scope > textarea, :scope > button').first()
          const l = await label.boundingBox(), c = await control.boundingBox()
          assert.ok(l && c, `${section}: visible label and control`)
          assert.ok(width > 700 ? c.x >= l.x + l.width + 19 && Math.abs(c.y + c.height / 2 - l.y - l.height / 2) < 2 : c.y >= l.y + l.height + 7, `${section}: consistent label/field alignment`)
          const padding = await row.evaluate(element => parseFloat(getComputedStyle(element).paddingTop))
          assert.equal(padding, 10, `${section}: compact row padding`)
          assert.ok(c.height >= 42, `${section}: controls retain comfortable hit targets`)
          assert.equal(await control.getAttribute('id'), await label.getAttribute('for'), `${section}: associated label`)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await page.screenshot({ path: `/tmp/odeon-aligned-${section}-${width}.png`, fullPage: true })
      }
      for (const section of ['school', 'plans', 'services', 'teachers', 'locations', 'calendar', 'policies']) {
        await page.goto(`http://127.0.0.1:3199/odeon-demo/school-setup?experience=configured&section=${section}`)
        const main = page.locator('main')
        if (section === 'locations') {
          const table = main.getByRole('table').first()
          await table.waitFor()
          for (const name of ['Room', 'Capacity', 'Services', 'Online link']) await table.getByRole('columnheader', { name, exact: true }).waitFor()
          const rows = table.getByRole('row')
          assert.ok(await rows.count() > 2, 'Room table groups multiple rooms')
          const first = await rows.nth(1).getByRole('cell').all()
          const second = await rows.nth(2).getByRole('cell').all()
          for (let index = 0; index < first.length; index++) {
            const a = await first[index].boundingBox(), b = await second[index].boundingBox()
            assert.ok(Math.abs(a.x - b.x) < 2, 'Room columns align across rows')
          }
          const serviceText = await rows.nth(1).getByRole('cell').nth(2).innerText()
          const names = serviceText.split(', ')
          assert.equal(new Set(names).size, names.length, 'Repeated service names are collapsed')
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
          await page.screenshot({ path: `/tmp/odeon-room-table-${width}.png`, fullPage: true })
        }
        if (['plans', 'services', 'teachers', 'locations'].includes(section)) {
          await main.getByRole('button', { name: /^Edit / }).first().click()
        }
        if (section === 'policies') {
          await main.getByRole('button', { name: 'Create school-wide agreement', exact: true }).click()
        }
        await check(section)
        if (section === 'plans') {
          await main.getByText('30 minutes (USD)', { exact: true }).waitFor()
          await main.getByText('45 minutes (USD)', { exact: true }).waitFor()
          await main.getByText('60 minutes (USD)', { exact: true }).waitFor()
          await main.getByRole('button', { name: 'Cancel', exact: true }).click()
          await main.getByRole('button', { name: 'Add discount', exact: true }).click()
          await check('discounts')
        }
        if (section === 'locations') {
          await main.getByRole('button', { name: 'Room 1 services', exact: true }).click()
          const box = await main.getByRole('listbox', { name: 'Room 1 services', exact: true }).boundingBox()
          const trigger = await main.getByRole('button', { name: 'Room 1 services', exact: true }).boundingBox()
          assert.ok(Math.abs(box.x - trigger.x) < 2 && Math.abs(box.width - trigger.width) < 2, 'Multi-select menu aligns with its field')
        }
      }
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}: consistent labeled-field alignment across school, pricing, services, teachers, rooms, calendar, agreements and discounts`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })