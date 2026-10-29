/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic browser fixtures; no live services. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.LEAD_TABLE_REVIEW_URL || 'http://127.0.0.1:3177'
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(8000)
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      await page.clock.install({ time: new Date('2026-10-29T12:00:00Z') })
      const row = (id, name, created_at, source_system, payload = {}) => ({ id, status: 'new', intake_type: 'lesson_inquiry', program_label: 'Piano', source_form: source_system, source_system,
        contact: { id, full_name: name, phone: '', email: `${id}@example.invalid` }, contact_id: id, created_at, updated_at: created_at, last_activity_at: created_at, payload })
      const fixtures = [row('old', 'A Old manual', '2026-10-27T12:00:00Z', 'pulse-manual'),
        row('new', 'Z New website', '2026-10-29T11:00:00Z', 'headliner-website', { student_name: 'Student Alpha', siblings: [{ name: 'Student Beta' }] }),
        row('edge', 'M Expiring manual', '2026-10-28T12:01:00Z', 'pulse-manual')]
      await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url())
        if (request.method() !== 'GET') { writes.push(url.pathname); return route.abort() }
        if (url.pathname === '/api/leads') {
          const leads = url.searchParams.get('intake_type') === 'lesson_inquiry' ? fixtures : []
          return route.fulfill({ json: url.searchParams.get('include_counts') === '1' ? { leads, counts: { lesson_inquiry: 3 } } : leads })
        }
        if (url.pathname === '/api/leads/new') return route.fulfill({ json: { ...fixtures[1], notes_history: [], events: [] } })
        return route.fulfill({ json: { connected: false, configured: false } })
      })
      await page.goto(base)
      const table = page.getByRole('table', { name: 'Leads', exact: true })
      await table.getByText('Student Alpha', { exact: false }).waitFor()
      const groups = table.getByRole('rowgroup')
      assert.equal(await groups.count(), 3)
      assert.match(await groups.first().innerText(), /Z New website/)
      assert.equal(await groups.first().getByRole('row').count(), 3, 'Family rows stay grouped')
      const background = locator => locator.evaluate(el => getComputedStyle(el).backgroundColor)
      assert.equal(await background(groups.first()), 'rgb(234, 242, 255)')
      assert.equal(await background(groups.nth(1)), 'rgb(234, 242, 255)')
      await page.clock.fastForward(61000)
      await page.waitForFunction(() => [...document.querySelectorAll('[role="rowgroup"]')].some(el => el.textContent.includes('M Expiring manual') && getComputedStyle(el).backgroundColor !== 'rgb(234, 242, 255)'))
      assert.equal(await background(groups.first()), 'rgb(234, 242, 255)')
      await page.getByRole('button', { name: 'Name', exact: true }).click()
      assert.match(await groups.first().innerText(), /A Old manual/)
      await page.getByRole('button', { name: 'Action first', exact: true }).click()
      assert.equal(await page.getByRole('button', { name: 'Action first', exact: true }).getAttribute('aria-pressed'), 'true')
      await table.getByText('Z New website', { exact: true }).click()
      await page.getByRole('button', { name: 'Edit lead', exact: true }).waitFor()
      const header = page.getByRole('heading', { name: 'Z New website', exact: true }).locator('xpath=../../..')
      const before = await header.innerText()
      const beforeBox = await header.boundingBox()
      await page.getByRole('button', { name: 'Edit lead', exact: true }).click()
      await page.getByRole('button', { name: 'Save changes', exact: true }).waitFor()
      const editingHeader = page.getByRole('heading', { name: 'Z New website', exact: true }).locator('xpath=../../..')
      assert.equal(await editingHeader.innerText(), before, 'Edit mode retains the complete original header')
      assert.equal((await editingHeader.boundingBox()).height, beforeBox.height)
      await page.getByLabel('Contact name', { exact: true }).fill('Unsaved name')
      assert.equal(await editingHeader.innerText(), before, 'Draft values do not change the original header')
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Keep editing', exact: true }).waitFor()
      await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
      await page.getByRole('button', { name: 'Edit lead', exact: true }).waitFor()
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: lead ordering/highlights, unchanged edit header, discard guard, family grouping, explicit sorting; no writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })