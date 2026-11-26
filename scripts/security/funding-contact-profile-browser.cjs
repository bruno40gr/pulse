/* eslint-disable @typescript-eslint/no-require-imports -- Loopback synthetic APIs only; never pays or submits invoices. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { createHarness, HEAD, DEMO } = require('./synthetic-harness.cjs')
const { createDemoFunding } = createHarness().load('lib/funding/demo.ts')
const base = process.env.FUNDING_PROFILE_REVIEW_URL || 'http://127.0.0.1:3271/funding-profile-review'
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname))
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      for (const demo of [false, true]) {
        const tenant = demo ? DEMO : HEAD
        const page = await browser.newPage({ viewport: { width, height: 1000 } })
        const errors = [], writes = [], reads = []
        await page.addInitScript(tenant => localStorage.setItem('pulse_active_tenant', tenant), tenant)
        const seed = createDemoFunding(DEMO).cases[0]
        let funding = { ...seed, id: 'case-one', studentPersonId: 'student', student: 'Sam Student', invoices: [{ ...seed.invoices[0], id: 'invoice-one', invoiceNumber: 'TEST-001', status: 'pending', amount: 100, statusEvents: [] }], amountExpected: 100, amountPaid: 0, outstanding: 100 }
        const contact = { id: 'student', tenant_id: tenant, first_name: 'Sam', last_name: 'Student', phone: '2025550101', email: 'sam@example.invalid', is_student: true, student_id: 'enrollment', client_status: 'active', custom_fields: {}, profile_enrollments: [] }
        let failStatus = true, releaseDetail
        const detailGate = new Promise(resolve => { releaseDetail = resolve })
        page.on('pageerror', error => errors.push(error.message))
        await page.route('**/api/**', async route => {
          const request = route.request(), url = new URL(request.url())
          const fulfill = (json, status = 200, headers = {}) => route.fulfill({ json, status, headers })
          reads.push(url.pathname)
          if (request.method() !== 'GET') writes.push({ path: url.pathname, tenant: url.searchParams.get('tenant'), body: request.postDataJSON() })
          if (demo) return fulfill([])
          if (url.pathname === '/api/funding/cases') return fulfill([funding])
          if (url.pathname === '/api/contacts/student') { await detailGate; return fulfill(contact) }
          if (url.pathname === '/api/contacts') return fulfill([contact], 200, { 'X-Contacts-Can-Edit': 'true' })
          if (url.pathname === '/api/funding/cases/case-one' && request.method() === 'PATCH') {
            funding = { ...funding, authorization: request.postDataJSON().authorization_reference }
            return fulfill(funding)
          }
          if (url.pathname.endsWith('/follow-ups')) return fulfill({ follow_ups: [], can_edit_inquiries: false })
          if (url.pathname === '/api/funding/invoices/invoice-one/status') {
            if (failStatus) return fulfill({ error: 'Synthetic invoice failure' }, 503)
            funding = { ...funding, invoices: funding.invoices.map(invoice => ({ ...invoice, status: 'paid', paidOn: request.postDataJSON().paid_on })), amountPaid: 100, outstanding: 0, status: 'paid', statusLabel: 'Paid' }
            return fulfill(funding)
          }
          return fulfill([])
        })
        await page.goto(base)
        const table = page.getByRole('table', { name: 'Funded Students', exact: true })
        const studentName = demo ? seed.student : 'Sam Student'
        await table.getByText(studentName, { exact: true }).click()
        if (!demo) {
          await page.getByRole('status', { name: 'Loading profile', exact: true }).waitFor()
          assert.equal(await page.getByRole('heading', { name: 'Funding details', exact: true }).count(), 0)
          releaseDetail()
        }
        const dialog = page.getByRole('dialog').first()
        await dialog.getByRole('heading', { name: 'Funding details', exact: true }).waitFor()
        const sections = dialog.getByRole('group', { name: 'Contact sections', exact: true })
        assert.equal(await sections.getByRole('button', { name: 'Funding Program', exact: true }).getAttribute('aria-pressed'), 'true')
        if (demo) {
          assert.equal(await dialog.getByRole('button', { name: 'Edit Contact', exact: true }).count(), 0)
          assert.equal(await sections.getByRole('button').count(), 2)
        }
        await dialog.getByRole('button', { name: 'Edit student details', exact: true }).click()
        const details = page.getByRole('dialog', { name: 'Edit student funding details', exact: true })
        await details.getByLabel('Authorization or purchase order', { exact: true }).fill('TEST-AUTH-UPDATED')
        await details.getByRole('button', { name: 'Save funding details', exact: true }).click()
        await details.waitFor({ state: 'hidden' })
        await dialog.getByText('TEST-AUTH-UPDATED', { exact: true }).waitFor()
        await sections.getByRole('button', { name: 'Billing', exact: true }).click()
        await dialog.getByRole('button', { name: 'Update status', exact: true }).first().click()
        const modal = page.getByRole('dialog', { name: 'Update invoice status', exact: true })
        await modal.getByLabel('New status', { exact: true }).selectOption('rejected')
        await modal.getByRole('button', { name: 'Save status', exact: true }).click()
        await modal.getByText('Rejection evidence is required.', { exact: true }).waitFor()
        assert.equal(writes.filter(write => write.path.includes('/invoices/')).length, 0)
        await modal.getByLabel('New status', { exact: true }).selectOption('paid')
        await modal.getByRole('button', { name: 'Save status', exact: true }).click()
        if (!demo) {
          await modal.getByText('Synthetic invoice failure', { exact: true }).waitFor()
          failStatus = false
          await modal.getByRole('button', { name: 'Save status', exact: true }).click()
        }
        await modal.waitFor({ state: 'hidden' })
        const invoiceNumber = demo ? seed.invoices[0].invoiceNumber : 'TEST-001'
        await dialog.getByText(invoiceNumber, { exact: true }).locator('../..').getByText('Paid', { exact: true }).waitFor()
        await page.keyboard.press('Escape')
        await dialog.waitFor({ state: 'hidden' })
        await table.getByText(studentName, { exact: true }).click()
        await dialog.getByRole('heading', { name: 'Funding details', exact: true }).waitFor()
        await sections.getByRole('button', { name: 'Billing', exact: true }).click()
        await dialog.getByText(invoiceNumber, { exact: true }).locator('../..').getByText('Paid', { exact: true }).waitFor()
        if (demo) {
          assert.equal(writes.length, 0)
          assert.ok(reads.every(path => !path.startsWith('/api/contacts') && !path.startsWith('/api/funding') && !path.startsWith('/api/inbox')))
          await page.reload()
          await table.getByText(studentName, { exact: true }).click()
          await sections.getByRole('button', { name: 'Billing', exact: true }).click()
          await page.getByRole('dialog').getByText(invoiceNumber, { exact: true }).locator('../..').getByText('Paid', { exact: true }).waitFor()
        } else {
          assert.equal(writes.filter(write => write.path === '/api/funding/invoices/invoice-one/status').length, 2)
          assert.ok(writes.every(write => write.tenant === tenant && ['/api/funding/invoices/invoice-one/status', '/api/funding/cases/case-one'].includes(write.path)))
        }
        assert.deepEqual(errors, [])
        console.log(`PASS ${width}px ${demo ? 'demo' : 'live'}: shared funding entry, Billing, invoice validation/persistence, ${demo ? 'session persistence and no operational requests' : 'loading skeleton, rejected-write recovery and tenant-scoped updates'}`)
        await page.close()
      }
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })