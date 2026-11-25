/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic browser fixtures, no live services. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const base = process.env.LEAD_FOLLOW_UP_REVIEW_URL || 'http://127.0.0.1:3191/existing-leads'
;(async () => {
  const browser = await chromium.launch()
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = []
      page.on('pageerror', error => errors.push(error.message))
      let lead = { id: 'inquiry', contact_id: 'contact', intake_type: 'lesson_inquiry', status: 'contacted', program_label: 'Piano', source_form: 'manual-other', source_page: null, created_at: '2026-10-28T10:00:00Z', updated_at: '2026-10-28T10:00:00Z', payload: { student_name: 'Synthetic Student' }, contact: { id: 'contact', full_name: 'Synthetic Contact', email: 'synthetic@example.invalid', phone: null }, notes_history: [], events: [] }
      let failSave = false
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url())
        if (url.pathname === '/api/leads/inquiry' && request.method() === 'PATCH') {
          const body = request.postDataJSON()
          writes.push(body)
          if (failSave) return route.fulfill({ status: 500, json: { error: 'Synthetic save failed' } })
          lead = { ...lead, payload: { ...lead.payload, ...body.payload }, ...body.payload }
          return route.fulfill({ json: lead })
        }
        assert.equal(request.method(), 'GET', `Unexpected write to ${url.pathname}`)
        if (url.pathname === '/api/leads/inquiry') return route.fulfill({ json: lead })
        if (url.pathname === '/api/leads') return route.fulfill({ json: url.searchParams.get('include_counts') === '1' ? { leads: [lead], counts: { lesson_inquiry: 1 } } : [lead] })
        return route.fulfill({ json: { connected: false, configured: false } })
      })
      const openFollowUp = async () => {
        await page.getByRole('table', { name: 'Leads', exact: true }).getByText('Synthetic Contact', { exact: true }).click()
        await page.getByRole('button', { name: /^(Add|Edit) follow-up$/ }).first().click()
        await page.getByLabel('Quick pick', { exact: true }).waitFor()
      }
      await page.goto(base)
      await openFollowUp()
      const save = page.getByRole('button', { name: 'Save follow-up', exact: true })
      assert.equal(await save.isEnabled(), true)
      await page.getByLabel('Quick pick', { exact: true }).selectOption('tomorrow')
      assert.equal(await save.isEnabled(), true)
      await page.getByLabel('Reminder note', { exact: true }).fill('Call after school')
      await save.click()
      await page.getByRole('dialog', { name: 'Synthetic Contact follow-up', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(writes[0].payload.follow_up_note, 'Call after school')
      assert.ok(Number.isFinite(Date.parse(writes[0].payload.follow_up_at)))
      await page.reload()
      await openFollowUp()
      assert.equal(await page.getByLabel('Reminder note', { exact: true }).inputValue(), 'Call after school')
      await page.getByLabel('Date', { exact: true }).fill('2026-11-15')
      await page.getByLabel('Reminder note', { exact: true }).fill('Updated reminder')
      failSave = true
      await page.getByRole('button', { name: 'Save follow-up', exact: true }).click()
      await page.getByText('Could not save follow-up. Your draft is retained. Please try again.', { exact: true }).waitFor()
      assert.equal(await page.getByLabel('Reminder note', { exact: true }).inputValue(), 'Updated reminder')
      failSave = false
      await page.getByRole('button', { name: 'Save follow-up', exact: true }).click()
      await page.getByRole('dialog', { name: 'Synthetic Contact follow-up', exact: true }).waitFor({ state: 'hidden' })
      assert.equal(lead.follow_up_note, 'Updated reminder')
      await page.screenshot({ path: `/tmp/pulse-follow-up-${width}.png`, fullPage: true })
      await page.getByRole('button', { name: 'Edit follow-up', exact: true }).first().click()
      await page.getByRole('button', { name: 'Clear follow-up', exact: true }).click()
      await page.getByRole('dialog', { name: 'Synthetic Contact follow-up', exact: true }).waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: 'Add follow-up', exact: true }).first().click()
      assert.equal(await page.getByLabel('Date', { exact: true }).inputValue(), '')
      assert.equal(await page.getByLabel('Reminder note', { exact: true }).inputValue(), '')
      assert.deepEqual(writes.at(-1), { payload: { follow_up_at: null, follow_up_note: null } })
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: read-only lead details retain schedule/update/clear, reload persistence, quick pick, failed-save draft`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })