/* eslint-disable @typescript-eslint/no-require-imports -- Local-only intercepted browser regression. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.PERFORMANCE_REVIEW_URL || 'http://127.0.0.1:3227/existing-leads'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local fixture only')

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = [], requests = []
    let releaseSummary
    const blockedSummary = new Promise(resolve => { releaseSummary = resolve })
    let summaryComplete = false
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url())
      requests.push({ path: url.pathname, query: url.search, method: route.request().method() })
      if (url.pathname === '/api/account/me') {
        await new Promise(resolve => setTimeout(resolve, 500))
        return route.fulfill({ json: { tenantId: url.searchParams.get('tenant'), membershipId: 'performance-staff', isOwner: true } })
      }
      if (url.pathname === '/api/leads' && url.searchParams.has('summary_only')) {
        await blockedSummary
        summaryComplete = true
        return route.fulfill({ json: { counts: { lesson_inquiry: 1, service_inquiry: 1, job_application: 0, winback: 0, enrolled: 0, lost: 0 }, pipelineValue: 120, closedSinceOct1: 0 } })
      }
      if (url.pathname === '/api/leads') {
        const service = url.searchParams.get('intake_type') === 'service_inquiry'
        return route.fulfill({ json: [{ id: service ? 'service' : 'lesson', intake_type: service ? 'service_inquiry' : 'lesson_inquiry', status: 'new', priority: 'normal', temperature: 'warm', source_form: 'manual-other', payload: {}, program_label: 'Piano', created_at: '2026-11-10T12:00:00Z', contact: { id: 'contact', full_name: service ? 'Service Fixture' : 'Lesson Fixture', email: null, phone: null } }] })
      }
      return route.fulfill({ json: { configured: false, connected: false, fullName: 'Fixture Staff', isDemo: false } })
    })
    await page.goto(base)
    const table = page.getByRole('table', { name: 'Leads', exact: true })
    await table.getByText('Lesson Fixture', { exact: true }).waitFor()
    assert.equal(summaryComplete, false, 'Rows render while summary remains blocked')
    const start = Date.now()
    await page.getByRole('button', { name: 'Columns & spacing', exact: true }).click()
    await page.getByRole('group', { name: 'Table display options', exact: true }).waitFor()
    const menuMs = Date.now() - start
    await page.keyboard.press('Escape')
    const services = page.getByRole('button', { name: /^Service/ })
    await services.click()
    await table.getByText('Service Fixture', { exact: true }).waitFor()
    assert.equal(summaryComplete, false, 'Tab rows do not wait for summary')
    releaseSummary()
    await page.waitForTimeout(750)
    const account = requests.filter(request => request.path === '/api/account/me')
    const summaries = requests.filter(request => request.query.includes('summary_only'))
    const lists = requests.filter(request => request.path === '/api/leads' && !request.query.includes('summary_only'))
    assert.equal(account.length, 1, 'Preferences and Delete share account request')
    assert.equal(summaries.length, 1, 'Tab switch reuses summary')
    assert.equal(lists.length, 2)
    assert.ok(lists.every(request => request.query.includes('include_counts=0')))
    assert.deepEqual(errors, [])
    assert.ok(requests.every(request => request.method === 'GET'), 'No writes')
    console.log(JSON.stringify({ passed: true, accountRequests: account.length, summaryRequests: summaries.length, listRequests: lists.length, menuMs, rowsRenderedWithBlockedSummary: true }))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })