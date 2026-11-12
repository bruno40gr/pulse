/* eslint-disable @typescript-eslint/no-require-imports -- Local intercepted browser test. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PREVIEW_REVIEW_URL || 'http://127.0.0.1:3227/existing-leads'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local fixture only')
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], writes = []; let detailRequests = 0, release
    const blocked = new Promise(resolve => { release = resolve })
    const lead = { id: 'preview-lead', source_form: 'lesson_inquiry', source_system: 'manual', intake_type: 'lesson_inquiry', status: 'new', priority: 'normal', temperature: 'warm', program_label: 'Piano', payload: {}, created_at: '2026-11-12T00:00:00Z', contact: { id: 'contact', full_name: 'Preview Fixture', email: 'fixture@example.invalid', phone: null } }
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      if (route.request().method() !== 'GET') { writes.push(url.pathname); return route.abort() }
      if (url.pathname === '/api/account/me') return route.fulfill({ json: { tenantId: url.searchParams.get('tenant'), membershipId: 'staff' } })
      if (url.pathname === '/api/leads/preview-lead') {
        detailRequests++; await blocked
        return route.fulfill({ json: { ...lead, contact: { ...lead.contact, notes: null }, events: [], notes_history: [] } })
      }
      if (url.pathname === '/api/leads') return route.fulfill({ json: { leads: [lead], counts: { lesson_inquiry: 1 } } })
      return route.fulfill({ json: { configured: false, connected: false } })
    })
    await page.goto(base)
    const name = page.getByRole('table', { name: 'Leads', exact: true }).getByText('Preview Fixture', { exact: true })
    await name.waitFor()
    await name.click()
    const loading = page.getByRole('heading', { name: 'Loading lead…', exact: true })
    await loading.waitFor({ timeout: 1500 })
    assert.equal(await page.getByText('Read-only preview from the loaded list', { exact: true }).count(), 0)
    assert.equal(await page.getByText(/Verifying current details/).count(), 0)
    await page.getByRole('button', { name: /close/i }).click()
    release(); await page.waitForTimeout(300)
    assert.equal(await loading.count(), 0, 'Late response must not reopen closed panel')
    await name.click()
    await page.getByRole('heading', { name: 'Preview Fixture', exact: true }).waitFor()
    await page.waitForFunction(() => !document.querySelector('[aria-label="Lead preview"]'))
    assert.equal(detailRequests, 2, 'One authorized request per opening, no prefetch')
    assert.deepEqual(writes, []); assert.deepEqual(errors, [])
    console.log(JSON.stringify({ passed: true, previewRemoved: true, detailRequests, lateResponseIgnored: true }))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })