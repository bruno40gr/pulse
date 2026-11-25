/* eslint-disable @typescript-eslint/no-require-imports -- Synthetic loopback-only browser acceptance; every API intercepted. */
const assert = require('node:assert/strict')
const { createHmac } = require('node:crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.FAMILY_REVIEW_URL || 'http://127.0.0.1:3271'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Loopback fixture only')
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`
const tenant = uuid(1), account = uuid(10), other = uuid(11), adultId = uuid(12)
const payload = Buffer.from(JSON.stringify({ actor: { instructorId: 'fixture', personId: 'fixture', displayName: 'Fixture', access: { kind: 'demo', tenantId: tenant } }, expiresAt: Date.now() + 3600000 })).toString('base64url')
const cookie = `${payload}.${createHmac('sha256', process.env.PULSE_SESSION_SECRET || 'pulse-headliner-session-2026').update(payload).digest('base64url')}`
;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } })
      page.setDefaultTimeout(20000)
      await page.context().addCookies([{ name: 'pulse_access', value: cookie, url: base }])
      const errors = [], unexpected = [], writes = []
      let reminder = null, links = [], linkingSupported = true
      let failFollowUps = false
      const adult = { id: adultId, tenant_id: tenant, first_name: 'Adult', last_name: 'Example', is_student: true,
        student_id: uuid(13), account_id: account, family_account_id: account, account_holder_person_id: adultId,
        account_holder_name: 'Adult Example', family_name: 'Adult Example', client_status: 'active', status_class: 'active',
        relationship_badges: ['Enrolled'], account_holders: [{ person_id: adultId, account_id: account, name: 'Adult Example', is_primary: true },
          { account_id: other, name: 'Alexandra Laustsen', phone: '2025550101', email: 'alex@example.invalid', is_primary: false }],
        phone: '', email: '', custom_fields: {}, profile_enrollments: [] }
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url()), path = url.pathname
        const fulfill = (data, status = 200, headers = {}) => route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(data) })
        if (path === '/api/contacts') return fulfill([adult], 200, { 'X-Contacts-Can-Edit': 'true', 'X-Contacts-Can-Read-Notes': 'true', 'X-Contacts-Can-Edit-Notes': 'true' })
        if (path === '/api/tenant-fields') return fulfill([])
        if (path === '/api/account/me') return fulfill({ user: { displayName: 'Fixture' } })
        if (path === '/api/tenant/sync-status') return fulfill({ last_synced_at: null })
        if (path === `/api/contacts/${adultId}/follow-ups`) return fulfill({ follow_ups: [], can_edit_inquiries: false })
        if (path === '/api/contacts/family') {
          if (request.method() === 'POST') {
            const body = request.postDataJSON(); writes.push(body)
            assert.equal(body.kind, 'family-account-link')
            assert.equal(body.memberAccountId, other)
            assert.equal(body.accountId, account)
            links = [{ family_account_id: account, member_account_id: other }]
            return fulfill({ saved: true })
          }
          return fulfill({ accounts: [{ id: account, name: 'Adult Example' }, { id: other, name: 'Legacy Holder Example' }],
            managers: [{ id: uuid(14), account_id: account, person_id: adultId, is_primary: true }],
            family_account_links: links, account_linking_supported: linkingSupported })
        }
        if (path === `/api/contacts/accounts/${account}/follow-ups`) {
          if (failFollowUps && request.method() === 'GET') return fulfill({ error: 'Could not load family follow-up. Please try again.' }, 503)
          if (request.method() === 'PATCH') {
            const body = request.postDataJSON(); writes.push(body)
            assert.equal(body.lead_intake_id, null)
            reminder = { id: uuid(15), account_id: account, status: body.action === 'complete' ? 'completed' : 'open', due_at: body.due_at || reminder?.due_at,
              message: body.message || reminder?.message, version: (reminder?.version || 0) + 1 }
            return fulfill({ follow_up: reminder })
          }
          await new Promise(resolve => setTimeout(resolve, 300))
          return fulfill({ follow_ups: reminder ? [reminder] : [], account_id: account })
        }
        unexpected.push(`${request.method()} ${path}`)
        return fulfill({ error: 'Unexpected synthetic API' }, 500)
      })
      await page.goto(`${base}/dashboard/contacts`)
      const table = page.getByRole('table', { name: 'Contacts', exact: true })
      await table.getByRole('button', { name: 'Adult Example', exact: true }).waitFor()
      assert.equal(await table.getByRole('button', { name: 'Adult Example', exact: true }).count(), 1)
      await table.getByText('Enrolled', { exact: true }).first().waitFor()
      await table.getByText('Alexandra Laustsen', { exact: true }).waitFor()
      await table.getByText('alex@example.invalid', { exact: true }).waitFor()
      assert.equal(await table.getByRole('checkbox', { name: 'Select Alexandra Laustsen', exact: true }).count(), 0)
      await table.getByRole('button', { name: 'Adult Example', exact: true }).click()
      const panel = page.getByRole('dialog').first()
      await panel.getByText('Account holders', { exact: true }).waitFor()
      await panel.getByText('Alexandra Laustsen', { exact: true }).waitFor()
      await panel.getByText('Family follow-up', { exact: true }).waitFor()
      assert.equal(await panel.getByText('0', { exact: true }).count() > 0, true)
      const familySection = panel.getByText('Family follow-up', { exact: true }).locator('..').locator('..')
      await familySection.getByText('No follow-up scheduled.', { exact: true }).waitFor()
      await familySection.getByRole('button', { name: 'Add follow-up', exact: true }).click()
      const modal = page.getByRole('dialog').last()
      await modal.getByLabel('Date', { exact: true }).fill('2026-12-05')
      await modal.getByLabel('Reminder note', { exact: true }).fill('Shared account reminder')
      await modal.getByRole('button', { name: 'Save follow-up', exact: true }).click()
      await panel.getByText('Shared account reminder', { exact: true }).waitFor()
      await panel.getByRole('button', { name: 'Complete', exact: true }).click()
      await panel.getByText('No follow-up scheduled.', { exact: true }).first().waitFor()
      await panel.getByRole('button', { name: 'Edit Contact', exact: true }).click()
      await panel.getByRole('button', { name: 'Manage account holders', exact: true }).click()
      const holders = page.getByRole('dialog', { name: 'Manage account holders', exact: true })
      await holders.getByRole('searchbox', { name: 'Search contacts', exact: true }).fill('Legacy Holder')
      await holders.getByRole('radio', { name: 'Legacy Holder Example', exact: true }).check()
      await holders.getByRole('button', { name: 'Link account holder', exact: true }).click()
      await holders.getByText('Legacy Holder Example · Linked co-holder', { exact: true }).waitFor()
      assert.equal(await holders.getByText(/Link an existing person or account|Existing-account linking requires|· Current account/).count(), 0)
      await holders.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      linkingSupported = false
      await panel.getByRole('button', { name: 'Edit Contact', exact: true }).click()
      await panel.getByRole('button', { name: 'Manage account holders', exact: true }).click()
      await holders.getByText('Legacy Holder Example · Linked co-holder', { exact: true }).waitFor()
      await holders.getByRole('searchbox', { name: 'Search contacts', exact: true }).fill('Legacy Holder')
      assert.equal(await holders.getByRole('radio', { name: 'Legacy Holder Example', exact: true }).isDisabled(), true)
      await holders.getByText(/Already linked co-holder/).waitFor()
      assert.equal(writes.length, 3)
      await holders.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await panel.getByRole('button', { name: 'Close', exact: true }).click()
      failFollowUps = true
      await table.getByRole('button', { name: 'Adult Example', exact: true }).click()
      await panel.getByText('Could not load family follow-up. Please try again.', { exact: false }).waitFor()
      await familySection.getByRole('button', { name: 'Add follow-up', exact: true }).click()
      await page.getByRole('dialog').last().getByLabel('Date', { exact: true }).waitFor()
      await page.getByRole('dialog').last().getByRole('button', { name: 'Cancel', exact: true }).click()
      assert.deepEqual(errors, [])
      assert.deepEqual(unexpected, [])
      console.log(`PASS ${width}px: adult holder appears once with Enrolled badge and zero dependents; account-owned reminder save/complete; legacy account searchable/linkable with explicit account operation; synthetic IO only`)
      await page.close()
    }
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })