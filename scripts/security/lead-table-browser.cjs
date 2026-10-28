/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic browser fixtures, no live services. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.LEAD_TABLE_REVIEW_URL || 'http://localhost:3157/existing-leads'
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.clock.setFixedTime(new Date('2026-10-28T12:00:00'))
      const lead = (id, status, payload = {}, phone = '+1 (916) 230-0511') => ({ id, status, payload, intake_type: 'lesson_inquiry', program_label: 'Piano', source_form: 'manual-other', contact_id: id, contact: { id, full_name: `Contact ${id}`, phone, email: `${id}@example.invalid` }, created_at: '2026-10-27T10:00:00Z', updated_at: '2026-10-27T10:00:00Z', last_activity_at: '2026-10-27T10:00:00Z' })
      const fixtures = [lead('terminal', 'won'), lead('family', 'contacted', { student_name: 'Student Alpha', siblings: [{ name: 'Student Beta', instrument_interest: 'Voice' }], follow_up_at: '2026-10-27T12:00:00' }), lead('today', 'booked', { same_as_contact: true, student_name: 'Contact today', follow_up_at: '2026-10-28T12:00:00' }), lead('single', 'new', { same_as_contact: true, student_name: 'Contact single' }, '(916) 798-8323')]
      await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url())
        if (request.method() !== 'GET') { writes.push(url.pathname); return route.abort() }
        if (url.pathname === '/api/leads') {
          const rows = url.searchParams.get('intake_type') === 'lesson_inquiry' ? fixtures : []
          return route.fulfill({ json: url.searchParams.get('include_counts') === '1' ? { leads: rows, counts: { lesson_inquiry: 4 } } : rows })
        }
        return route.fulfill({ json: { connected: false, configured: false } })
      })
      await page.goto(base)
      console.log(`Loaded ${width}px synthetic fixture`)
      const table = page.getByRole('table', { name: 'Leads', exact: true })
      await table.getByText('Student Alpha', { exact: false }).waitFor()
      const groups = table.getByRole('rowgroup')
      assert.equal(await groups.count(), 4)
      assert.match(await groups.nth(0).innerText(), /Contact family/)
      assert.match(await groups.nth(1).innerText(), /Contact today/)
      assert.match(await groups.nth(3).innerText(), /Contact terminal/)
      assert.equal(await groups.nth(0).getByRole('row').count(), 3)
      const parent = groups.nth(0).getByRole('row').nth(0), child = groups.nth(0).getByRole('row').nth(1)
      assert.equal((await parent.boundingBox()).height, 40)
      assert.equal((await child.boundingBox()).height, 32)
      assert.equal(await child.getByRole('cell').nth(3).innerText(), '')
      assert.equal(await child.getByRole('cell').nth(4).innerText(), '')
      assert.equal(await child.getByRole('cell').nth(2).locator('span').first().evaluate(el => getComputedStyle(el).paddingLeft), '20px')
      assert.equal(await groups.nth(1).evaluate(el => getComputedStyle(el).borderTopWidth), '1px')
      assert.equal(await parent.evaluate(el => getComputedStyle(el).borderBottomWidth), '0px')
      assert.equal(await child.evaluate(el => getComputedStyle(el).borderBottomWidth), '0px')
      assert.equal(await groups.nth(3).evaluate(el => getComputedStyle(el).opacity), '0.6')
      assert.equal(await parent.getByRole('cell').nth(3).innerText(), '(916) 230-0511')
      assert.equal(await parent.getByRole('cell').nth(3).locator('div').evaluate(el => getComputedStyle(el).fontVariantNumeric), 'tabular-nums')
      const overdue = parent.getByRole('cell').nth(5).locator('span')
      assert.equal(await overdue.evaluate(el => getComputedStyle(el).color), 'rgb(220, 38, 38)')
      assert.equal(await groups.nth(1).getByRole('row').first().getByRole('cell').nth(5).locator('span').evaluate(el => getComputedStyle(el).color), 'rgb(146, 64, 14)')
      assert.equal(await groups.nth(2).getByRole('row').first().getByRole('cell').nth(5).innerText(), '')
      assert.doesNotMatch(await table.innerText(), /🔥|🧊|❄/)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
      await page.screenshot({ path: `/tmp/pulse-lead-table-${width}.png`, fullPage: true })
      await table.getByRole('button', { name: 'Name', exact: true }).click()
      assert.match(await groups.first().innerText(), /Contact family/)
      await table.getByRole('button', { name: 'Name, sorted ascending', exact: true }).click()
      assert.match(await groups.first().innerText(), /Contact today/)
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${width}px: family boundaries/indent, density, blank cells, muted phones, urgency, action order, manual sort, no writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })