/* eslint-disable @typescript-eslint/no-require-imports -- Fictional fixtures, API writes intercepted, SMS simulated in memory. */
const assert = require('node:assert/strict')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.CONTACT_ROLE_REVIEW_ORIGIN || 'http://127.0.0.1:3218'
const person = (id, first, patch = {}) => ({ id: `mock-${id}`, tenant_id: 'review', first_name: first, last_name: 'Kim', phone: null, email: null,
  account_id: 'kim', account_holder_person_id: 'mock-sam', account_holder_name: 'Sam Kim', account_holder_phone: '(202) 555-0102', account_holder_email: 'sam@example.invalid',
  client_status: 'active', is_student: true, student_id: `student-${id}`, is_minor: false, opted_out: false, notes: null, last_attended: null, family_name: null, custom_fields: {}, ...patch })
;(async () => {
  const browser = await chromium.launch()
  console.log("Browser started")
  try {
    for (const width of [1440, 900, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(8000)
      const errors = [], blocked = []
      let adult = false, missing = false
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname
        if (request.method() !== 'GET') {
          if (path === '/api/inbox/reconcile') return route.fulfill({ json: { skipped: true } })
          if (path === '/api/contact-insights') return route.fulfill({ json: { insights: [] } })
          if (path === '/api/contacts/check-sensitive') return route.fulfill({ json: { flagged: [], opted_out: [] } })
          blocked.push(path)
          return route.abort()
        }
        const rows = [person('sam', 'Sam', { is_student: false, student_id: null, phone: '(202) 555-0102' }),
          person('sophie', 'Sophie', { is_minor: true, account_holder_phone: missing ? null : '(202) 555-0102' }),
          person('ethan', 'Ethan', { is_minor: !adult, phone: '(202) 555-0105' })]
        let json = {}
        if (path === '/api/contacts') json = rows
        if (path === '/api/tenant-fields' || path === '/api/staff') json = []
        if (path === '/api/account/me') json = { tenantId: url.searchParams.get('tenant'), membershipId: 'kim-review' }
        if (path === '/api/leads') json = [{ id: 'lead', contact_id: 'mock-sam', contact: { id: 'mock-sam', full_name: 'Sam Kim' }, intake_type: 'lesson_inquiry', status: 'contacted', payload: { student_name: 'Sophie Kim' }, created_at: '2026-10-30T10:00:00Z' }]
        if (path === '/api/leads' && url.searchParams.get('include_counts') === '1') json = { leads: json, counts: { lesson_inquiry: 1 } }
        return route.fulfill({ json })
      })
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      const close = () => page.getByRole('button', { name: 'Close', exact: true }).click()
      const open = async name => {
        await table.getByRole('button', { name, exact: true }).click()
        await page.getByRole('heading', { name, exact: true }).waitFor()
      }
      const sms = async (subject, recipient, number) => {
        console.log(`Opening ${subject} at ${width}`)
        await open(subject)
        await page.getByRole('button', { name: 'Send SMS', exact: true }).click()
        await page.getByRole('heading', { name: 'Send a Text Message', exact: true }).waitFor()
        await page.getByText(`About ${subject}; recipient ${recipient}`, { exact: true }).waitFor()
        assert.ok(await page.getByText(number, { exact: false }).count() > 0)
        await page.getByPlaceholder('Write your message... Use {first_name} to personalize.').fill(`Checking on ${subject}.`)
        await page.getByRole('button', { name: 'Send message', exact: true }).click()
        await page.getByRole('status').filter({ hasText: 'Message sent.' }).waitFor()
        await page.getByRole('button', { name: 'Back to contact', exact: true }).click()
        await page.getByRole('heading', { name: subject, exact: true }).waitFor()
        await close()
      }
      console.log(`Contacts navigation ${width}`)
      await page.goto(`${base}/dashboard/contacts`)
      await table.getByRole('button', { name: 'Sophie Kim', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '16px')
      assert.equal(await table.getByRole('checkbox').count(), 2, 'Select all and holder only')
      assert.equal(await table.getByRole('button', { name: /Expand|Collapse/ }).count(), 0)
      await sms('Sophie Kim', 'Sam Kim', '(202) 555-0102')
      await sms('Sam Kim', 'Sam Kim', '(202) 555-0102')
      await sms('Ethan Kim', 'Sam Kim', '(202) 555-0102')
      adult = true
      await page.reload()
      await sms('Ethan Kim', 'Ethan Kim', '(202) 555-0105')
      missing = true
      await page.reload()
      await open('Sophie Kim')
      assert.equal(await page.getByRole('button', { name: 'Send SMS', exact: true }).isDisabled(), true)
      await close()
      // Real Settings surface and both tables share the same dashboard layout/root scale.
      await page.goto(`${base}/dashboard/settings`)
      await page.getByRole('slider', { name: 'Base font size' }).fill('18')
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '18px')
      await page.goto(`${base}/dashboard/contacts`)
      await table.getByRole('button', { name: 'Sam Kim', exact: true }).waitFor()
      const font = async name => page.getByRole('table', { name, exact: true }).getByText('Sam Kim', { exact: true }).first().evaluate(el => {
        const s = getComputedStyle(el)
        return [s.fontFamily, s.fontSize, s.fontWeight, s.lineHeight, s.letterSpacing]
      })
      const contactFont = await font('Contacts')
      await page.goto(`${base}/dashboard/leads`)
      const leads = page.getByRole('table', { name: 'Leads', exact: true })
      await leads.getByText('Sam Kim', { exact: true }).waitFor()
      assert.deepEqual(await font('Leads'), contactFont)
      assert.equal(contactFont[1], '16.875px')
      if (width < 1024) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
      await page.getByRole('link', { name: 'Settings', exact: true }).waitFor()
      missing = false
      await page.goto(`${base}/dashboard/contacts`)
      await open('Sophie Kim')
      await page.screenshot({ path: `/tmp/pulse-kim-contact-panel-${width}.png`, fullPage: true })
      await page.getByRole('button', { name: 'Send SMS', exact: true }).click()
      await page.getByText('About Sophie Kim; recipient Sam Kim', { exact: true }).waitFor()
      await page.screenshot({ path: `/tmp/pulse-kim-sms-${width}.png`, fullPage: true })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      assert.deepEqual(blocked, [])
      assert.deepEqual(errors, [])
      console.log(`PASS ${width}px: Sophie/minor Ethan → Sam; adult Ethan → Ethan; Sam direct; missing holder disabled; simulated sends/back/close; shared Settings font parity; zero unapproved writes`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })