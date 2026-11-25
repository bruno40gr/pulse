/* eslint-disable @typescript-eslint/no-require-imports -- Loopback-only synthetic browser checks; no production access. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.RESTORATION_REVIEW_URL || 'http://127.0.0.1:3271'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) throw new Error('Local fixture only')
const tenant = '00000000-0000-0000-0000-000000000001'

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      const errors = [], writes = [], workspaceReads = []
      page.on('pageerror', error => errors.push(error.message))
      let releaseContacts, releaseWorkspace
      const contactsGate = new Promise(resolve => { releaseContacts = resolve })
      const workspaceGate = new Promise(resolve => { releaseWorkspace = resolve })
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url())
        if (request.method() !== 'GET') {
          writes.push(`${request.method()} ${url.pathname}`)
          return route.fulfill({ status: 500, json: { error: 'Unexpected fixture write' } })
        }
        if (url.pathname === '/api/contacts') {
          await contactsGate
          return route.fulfill({ headers: { 'X-Contacts-Can-Edit': 'true' }, json: [{
            id: 'synthetic-student', tenant_id: tenant, first_name: 'Synthetic', last_name: 'Student',
            student_id: 'synthetic-role', is_student: true, client_status: 'active', custom_fields: {},
            profile_enrollments: [{ id: 'synthetic-enrollment', instrument: 'Voice', level: 2,
              duration: 45, service_type: 'Private', instructor: null, teacher_assignment_needs_review: true }],
          }] })
        }
        if (url.pathname === '/api/academy/workspace') {
          workspaceReads.push(url.searchParams.get('tenant'))
          await workspaceGate
          return route.fulfill({ status: 503, json: { error: 'Synthetic school workspace unavailable' } })
        }
        if (url.pathname.includes('/follow-ups')) return route.fulfill({ json: { follow_ups: [], can_edit_inquiries: false } })
        if (url.pathname === '/api/tenant-fields' || url.pathname === '/api/funding/cases') return route.fulfill({ json: [] })
        return route.fulfill({ json: {} })
      })
      await page.goto(`${base}/dashboard/contacts`)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      await table.getByRole('row').nth(7).waitFor()
      assert.equal(await page.getByText('0 contacts', { exact: true }).count(), 0)
      assert.equal(await page.getByText('No contacts found.', { exact: true }).count(), 0)
      assert.equal(await page.getByText('Synthetic Student', { exact: true }).count(), 0)
      releaseContacts()
      const student = page.getByRole('button', { name: 'Synthetic Student', exact: true }).first()
      await student.waitFor()
      await student.focus()
      const focus = await student.evaluate(element => ({ active: document.activeElement === element,
        outline: getComputedStyle(element).outlineStyle, shadow: getComputedStyle(element).boxShadow }))
      assert.equal(focus.active, true, 'Focus remains available for keyboard navigation')
      assert.equal(focus.outline, 'none')
      assert.equal(focus.shadow, 'none')
      await student.click()
      await page.getByRole('heading', { name: 'Voice • Level 2', exact: true }).waitFor()
      await page.getByText('Private • 45 min', { exact: true }).waitFor()
      await page.getByText('Current teacher needs verification', { exact: true }).waitFor()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)

      await page.evaluate(() => localStorage.setItem('odeon:app-sample:v2', 'untouched-synthetic-sentinel'))
      await page.goto(`${base}/odeon-demo?tenant=${tenant}&screen=staff&person=synthetic-person`)
      await page.waitForURL('**/dashboard/staff?person=synthetic-person')
      assert.equal(workspaceReads.length, 0, 'Operational Staff redirect must not read the sample workspace')
      assert.equal(await page.evaluate(() => localStorage.getItem('odeon:app-sample:v2')), 'untouched-synthetic-sentinel')

      await page.goto(`${base}/odeon-demo?tenant=${tenant}&screen=contacts`)
      await page.getByRole('status', { name: 'Loading school workspace', exact: true }).waitFor()
      assert.equal(await page.getByText(/Fictional records only/).count(), 0)
      releaseWorkspace()
      await page.getByText('Synthetic school workspace unavailable', { exact: true }).waitFor()
      assert.equal(await page.getByRole('link', { name: 'Return to school staff', exact: true }).getAttribute('href'), '/dashboard/staff')
      assert.equal(await page.getByText(/Fictional records only/).count(), 0)
      assert.deepEqual(workspaceReads, [tenant])
      assert.equal(await page.evaluate(() => localStorage.getItem('odeon:app-sample:v2')), 'untouched-synthetic-sentinel')
      assert.deepEqual(writes, [])
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: delayed Contacts/workspace skeletons, explicit subscription fields, unresolved teacher, keyboard focus without rings, Staff redirect, no sample fallback/storage clearing or writes; synthetic loopback host only`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })