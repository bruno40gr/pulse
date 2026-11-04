/* eslint-disable @typescript-eslint/no-require-imports -- Fictional fixtures; no live services or writes. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.LEAD_TABLE_REVIEW_URL || 'http://127.0.0.1:3218/dashboard/leads'
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      let listRequests = 0
      const fixtures = Array.from({ length: 73 }, (_, index) => ({
        id: `lead-${index}`, contact_id: `contact-${index}`, status: 'new', intake_type: 'lesson_inquiry',
        program_label: 'Piano', source_form: 'manual-other',
        payload: { student_name: `Student ${index} Alpha`, siblings: [{ name: `Student ${index} Beta`, instrument_interest: 'Voice' }] },
        contact: { id: `contact-${index}`, full_name: `Family ${String(index).padStart(3, '0')}`, phone: null, email: null },
        created_at: '2026-10-27T10:00:00Z', updated_at: '2026-10-27T10:00:00Z', last_activity_at: '2026-10-27T10:00:00Z',
      }))
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url())
        if (request.method() === 'POST' && url.pathname === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
        if (request.method() !== 'GET') { writes.push(url.pathname); return route.abort() }
        if (url.pathname === '/api/account/me') return route.fulfill({ json: { membershipId: 'pagination-review', tenantId: url.searchParams.get('tenant') } })
        if (url.pathname === '/api/leads' && url.searchParams.get('count_only')) return route.fulfill({ json: { count: 73 } })
        if (url.pathname === '/api/leads') {
          listRequests++
          return route.fulfill({ json: { leads: fixtures, counts: { lesson_inquiry: 73 } } })
        }
        return route.fulfill({ json: { configured: false, connected: false } })
      })
      await page.goto(base)
      const pagination = page.getByRole('navigation', { name: 'Leads pagination', exact: true })
      const size = pagination.getByRole('combobox', { name: 'families per page', exact: true })
      await size.waitFor()
      assert.equal(await size.inputValue(), '50')
      const selectAll = page.getByRole('checkbox', { name: 'Select all visible leads', exact: true })
      const rowChecks = () => page.getByRole('table', { name: 'Leads', exact: true }).getByRole('checkbox').count()
      assert.equal(await rowChecks(), 51, '50 inquiry checkboxes plus select-all')
      await pagination.getByText('Page 1 of 2', { exact: true }).waitFor()
      await pagination.getByRole('button', { name: 'Next', exact: true }).click()
      assert.equal(await rowChecks(), 24)
      await size.selectOption('25')
      await pagination.getByText('Page 1 of 3', { exact: true }).waitFor()
      assert.equal(await rowChecks(), 26)
      await selectAll.check()
      await size.selectOption('100')
      await pagination.getByText('Page 1 of 1', { exact: true }).waitFor()
      assert.equal(await rowChecks(), 74)
      assert.equal(await page.getByRole('table', { name: 'Leads', exact: true }).getByRole('checkbox', { checked: true }).count(), 25, 'Page-size change preserves selected inquiries')
      await page.getByRole('table', { name: 'Leads', exact: true }).getByText('Student 0 Alpha', { exact: false }).waitFor()
      await page.getByRole('table', { name: 'Leads', exact: true }).getByText('Student 0 Beta', { exact: false }).waitFor()
      await page.getByRole('switch', { name: 'Families', exact: true }).click()
      const individualSize = pagination.getByRole('combobox', { name: 'account holders per page', exact: true })
      assert.equal(await individualSize.inputValue(), '100')
      await individualSize.selectOption('250')
      assert.equal(await rowChecks(), 74)
      assert.equal(listRequests, 1, 'Page size and view do not refetch the loaded list')
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
      await page.screenshot({ path: `/private/tmp/leads-pagination-${width}.png`, fullPage: true })
      assert.deepEqual(errors, []); assert.deepEqual(writes, [])
      console.log(`PASS ${width}px: default 50, all page sizes, page reset, selection retained, intact students, view labels, no refetch/writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })