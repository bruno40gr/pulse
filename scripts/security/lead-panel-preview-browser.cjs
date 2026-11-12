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
    const start = Date.now(); await name.click()
    const preview = page.getByRole('region', { name: 'Lead preview', exact: true })
    await preview.waitFor({ timeout: 1500 })
    const previewMs = Date.now() - start
    assert.equal(await preview.getByText('fixture@example.invalid', { exact: true }).count(), 1)
    assert.equal(await preview.getByRole('button').count(), 1, 'Only close is enabled; no mutation or messaging actions')
    await preview.getByRole('button').click()
    release(); await page.waitForTimeout(300)
    assert.equal(await preview.count(), 0, 'Late response must not reopen closed panel')
    await name.click()
    await page.getByRole('heading', { name: 'Preview Fixture', exact: true }).waitFor()
    await page.waitForFunction(() => !document.querySelector('[aria-label="Lead preview"]'))
    assert.equal(detailRequests, 2, 'One authorized request per opening, no prefetch')
    assert.deepEqual(writes, []); assert.deepEqual(errors, [])
    console.log(JSON.stringify({ passed: true, previewMs, detailRequests, lateResponseIgnored: true }))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })